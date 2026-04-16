"""Billing router — Stripe checkout, portal, webhooks, and subscription status."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.subscription import Subscription, SubscriptionStatus
from app.middleware.auth import get_current_user
from app.services import stripe_service

router = APIRouter(prefix="/billing", tags=["Billing"])


async def _get_user_org_id(user: User, db: AsyncSession) -> str:
    """Get the user's primary organization ID. Create a default org if none exists."""
    result = await db.execute(
        select(Organization).where(Organization.owner_id == user.id).limit(1)
    )
    org = result.scalar_one_or_none()
    if org:
        return org.id
    # Auto-create personal org
    import uuid
    org = Organization(
        id=str(uuid.uuid4()),
        name=f"{user.display_name or user.email}'s Org",
        slug=f"org-{user.id[:8]}",
        owner_id=user.id,
        plan=user.plan,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org.id


# ─── Request/Response schemas ───

class CheckoutRequest(BaseModel):
    success_url: str | None = None
    cancel_url: str | None = None


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    current_period_end: str | None


class EmbeddedCheckoutResponse(BaseModel):
    client_secret: str
    subscription_id: str
    customer_id: str


class StripeConfigResponse(BaseModel):
    publishable_key: str


# ─── Endpoints ───

@router.get("/config", response_model=StripeConfigResponse)
async def get_stripe_config():
    """Return Stripe publishable key for the frontend."""
    if not settings.stripe_publishable_key:
        raise HTTPException(status_code=503, detail="Stripe no está configurado")
    return StripeConfigResponse(publishable_key=settings.stripe_publishable_key)


@router.post("/create-subscription", response_model=EmbeddedCheckoutResponse)
async def create_embedded_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an incomplete subscription for embedded payment via Stripe Elements."""
    import stripe as stripe_lib
    stripe_lib.api_key = settings.stripe_secret_key

    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe no está configurado")

    if user.plan == "premium":
        raise HTTPException(status_code=400, detail="Ya tienes el plan Premium")

    org_id = await _get_user_org_id(user, db)

    # Get or create Stripe customer
    result = await db.execute(
        select(Subscription).where(Subscription.org_id == org_id)
    )
    sub = result.scalar_one_or_none()

    if sub and sub.stripe_customer_id:
        customer_id = sub.stripe_customer_id
    else:
        customer = stripe_lib.Customer.create(
            email=user.email,
            name=user.display_name or user.email,
            metadata={"nexus_user_id": user.id, "nexus_org_id": org_id},
        )
        customer_id = customer.id

    try:
        price_id = stripe_service.get_premium_price_id()

        # Cancel any previous incomplete subscription in Stripe
        if sub and sub.stripe_subscription_id:
            try:
                old_sub = stripe_lib.Subscription.retrieve(sub.stripe_subscription_id)
                if old_sub.status in ("incomplete", "incomplete_expired"):
                    stripe_lib.Subscription.cancel(sub.stripe_subscription_id)
            except Exception:
                pass  # Old sub might not exist anymore

        subscription = stripe_lib.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            payment_settings={"save_default_payment_method": "on_subscription"},
            expand=["latest_invoice.payment_intent"],
            metadata={"nexus_user_id": user.id, "nexus_org_id": org_id},
        )

        # Extract client_secret safely
        invoice = subscription.latest_invoice
        pi = invoice.payment_intent if invoice else None
        if not pi or not pi.client_secret:
            raise ValueError("No se pudo obtener el client_secret del payment intent.")

        # Save customer ID early
        if not sub:
            sub = Subscription(
                org_id=org_id,
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription.id,
                plan="free",
                status=SubscriptionStatus.incomplete,
            )
            db.add(sub)
        else:
            sub.stripe_customer_id = customer_id
            sub.stripe_subscription_id = subscription.id
        await db.commit()

        return EmbeddedCheckoutResponse(
            client_secret=pi.client_secret,
            subscription_id=subscription.id,
            customer_id=customer_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando suscripción: {str(e)}")

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session for upgrading to Premium."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe no está configurado")

    if user.plan == "premium":
        raise HTTPException(status_code=400, detail="Ya tienes el plan Premium")

    org_id = await _get_user_org_id(user, db)

    # Check if user has an existing Stripe customer ID
    result = await db.execute(
        select(Subscription).where(Subscription.org_id == org_id)
    )
    sub = result.scalar_one_or_none()
    customer_id = sub.stripe_customer_id if sub else None

    try:
        base = body.success_url or f"{settings.frontend_url}/dashboard/billing?status=success"
        cancel = body.cancel_url or f"{settings.frontend_url}/dashboard/billing?status=cancelled"

        checkout_url = stripe_service.create_checkout_session(
            user_id=user.id,
            user_email=user.email,
            stripe_customer_id=customer_id,
            success_url=base,
            cancel_url=cancel,
        )
        return CheckoutResponse(checkout_url=checkout_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando sesión de pago: {str(e)}")


@router.post("/portal", response_model=PortalResponse)
async def create_portal(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Customer Portal session for managing subscription."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe no está configurado")

    org_id = await _get_user_org_id(user, db)

    result = await db.execute(
        select(Subscription).where(Subscription.org_id == org_id)
    )
    sub = result.scalar_one_or_none()

    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No tienes una suscripción activa")

    try:
        portal_url = stripe_service.create_portal_session(
            stripe_customer_id=sub.stripe_customer_id,
            return_url=f"{settings.frontend_url}/dashboard/billing",
        )
        return PortalResponse(portal_url=portal_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error abriendo portal: {str(e)}")


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current subscription details."""
    org_id = await _get_user_org_id(user, db)

    result = await db.execute(
        select(Subscription).where(Subscription.org_id == org_id)
    )
    sub = result.scalar_one_or_none()

    return SubscriptionResponse(
        plan=user.plan,
        status=sub.status if sub else "none",
        stripe_customer_id=sub.stripe_customer_id if sub else None,
        stripe_subscription_id=sub.stripe_subscription_id if sub else None,
        current_period_end=sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
    )


@router.post("/webhook", status_code=200)
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events (checkout completed, subscription changes, etc.)."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event_data = stripe_service.handle_webhook_event(payload, sig_header)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    if not event_data.get("processed"):
        return {"status": "ignored", "event": event_data.get("event_type")}

    action = event_data.get("action")
    user_id = event_data.get("user_id")
    customer_id = event_data.get("customer_id")
    subscription_id = event_data.get("subscription_id")

    # ─── Upgrade to Premium ───
    if action == "upgrade_to_premium" and user_id:
        # Update user plan
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            user.plan = "premium"

        # Upsert subscription record
        sub_result = await db.execute(
            select(Subscription).where(Subscription.org_id == user_id)
        )
        sub = sub_result.scalar_one_or_none()
        if sub:
            sub.stripe_customer_id = customer_id
            sub.stripe_subscription_id = subscription_id
            sub.plan = "premium"
            sub.status = SubscriptionStatus.active
        else:
            sub = Subscription(
                org_id=user_id,
                stripe_customer_id=customer_id,
                stripe_subscription_id=subscription_id,
                plan="premium",
                status=SubscriptionStatus.active,
            )
            db.add(sub)

        await db.commit()
        print(f"✅ Stripe: User {user_id} upgraded to Premium")

    # ─── Downgrade to Free ───
    elif action == "downgrade_to_free" and user_id:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            user.plan = "free"

        sub_result = await db.execute(
            select(Subscription).where(Subscription.org_id == user_id)
        )
        sub = sub_result.scalar_one_or_none()
        if sub:
            sub.plan = "free"
            sub.status = SubscriptionStatus.canceled

        await db.commit()
        print(f"⚠️ Stripe: User {user_id} downgraded to Free")

    # ─── Subscription updated ───
    elif action == "subscription_updated" and user_id:
        stripe_status = event_data.get("status", "active")
        sub_result = await db.execute(
            select(Subscription).where(Subscription.org_id == user_id)
        )
        sub = sub_result.scalar_one_or_none()
        if sub:
            if stripe_status == "canceled":
                sub.status = SubscriptionStatus.canceled
                # Also downgrade user
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                if user:
                    user.plan = "free"
            elif stripe_status == "past_due":
                sub.status = SubscriptionStatus.past_due
            else:
                sub.status = SubscriptionStatus.active

        await db.commit()
        print(f"📝 Stripe: Subscription updated for user {user_id} → {stripe_status}")

    return {"status": "processed", "action": action}
