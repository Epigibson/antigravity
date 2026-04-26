"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, type UserResponse } from "@/lib/api";
import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signUp, 
  signOut as amplifySignOut, 
  fetchAuthSession, 
  getCurrentUser,
  confirmSignIn,
  confirmSignUp,
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  fetchMFAPreference,
  type SignInOutput
} from 'aws-amplify/auth';

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
      },
    }
  }
});

interface MfaSetupResult {
  qrCodeUri: string;
  secretKey: string;
}

interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<SignInOutput>;
  confirmMfa: (challengeResponse: string) => Promise<SignInOutput>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setupTotp: () => Promise<MfaSetupResult>;
  verifyTotp: (code: string) => Promise<void>;
  getMfaStatus: () => Promise<{ enabled: boolean; preferred: string | null }>;
  disableMfa: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await fetchAuthSession();
        if (session.tokens?.idToken) {
          const jwtToken = session.tokens.idToken.toString();
          setToken(jwtToken);
          localStorage.setItem("ag_token", jwtToken);
          
          // Fetch profile from backend using Cognito token
          try {
            const profile = await api.getProfile();
            setUser(profile);
          } catch (e) {
            console.error("Failed to fetch profile from backend", e);
            // Si el backend aún no tiene al usuario, tal vez debamos sincronizarlo aquí
            // Por ahora, lo limpiamos si falla el backend
            setUser(null);
            setToken(null);
            localStorage.removeItem("ag_token");
          }
        }
      } catch (e) {
        // Not signed in
        console.log("No valid session found", e);
        setToken(null);
        setUser(null);
        localStorage.removeItem("ag_token");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    let result;
    try {
      result = await signIn({ username: email, password });
    } catch (err: any) {
      if (err.name === 'UserAlreadyAuthenticatedException' || (err.message && err.message.includes('already a signed in user'))) {
        await amplifySignOut();
        result = await signIn({ username: email, password });
      } else {
        throw err;
      }
    }
    
    if (result.isSignedIn) {
      const session = await fetchAuthSession();
      const jwtToken = session.tokens?.idToken?.toString() || '';
      setToken(jwtToken);
      localStorage.setItem("ag_token", jwtToken);
      
      try {
        const profile = await api.getProfile();
        setUser(profile);
        router.push("/dashboard");
      } catch (error) {
        console.error("Profile sync error after login", error);
      }
    }
    
    return result;
  }, [router]);

  const confirmMfa = useCallback(async (challengeResponse: string) => {
    const result = await confirmSignIn({ challengeResponse });
    if (result.isSignedIn) {
      const session = await fetchAuthSession();
      const jwtToken = session.tokens?.idToken?.toString() || '';
      setToken(jwtToken);
      localStorage.setItem("ag_token", jwtToken);
      
      try {
        const profile = await api.getProfile();
        setUser(profile);
        router.push("/dashboard");
      } catch (error) {
        console.error("Profile sync error after MFA", error);
      }
    }
    return result;
  }, [router]);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name: displayName || email.split("@")[0]
        }
      }
    });
    // Recordar: Backend necesita crear el usuario en su base de datos. Lo haremos en confirmRegistration o vía Cognito Trigger.
  }, []);

  const confirmRegistration = useCallback(async (email: string, code: string) => {
    await confirmSignUp({
      username: email,
      confirmationCode: code
    });
    // Opcionalmente, hacer auto-login aquí o redirigir a login
  }, []);

  const logout = useCallback(async () => {
    try {
      await amplifySignOut();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem("ag_token");
    router.push("/login");
  }, [router]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
    } catch (error) {
      console.error("Error refreshing profile", error);
    }
  }, []);

  const setupTotp = useCallback(async (): Promise<MfaSetupResult> => {
    const totpSetupDetails = await setUpTOTP();
    const secret = totpSetupDetails.sharedSecret;
    const issuer = 'Nexus';
    const account = user?.email || 'user';
    // Build TOTP URI manually so authenticator apps show the email, not the UUID
    const qrCodeUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    return {
      qrCodeUri,
      secretKey: secret,
    };
  }, [user?.email]);

  const verifyTotp = useCallback(async (code: string) => {
    await verifyTOTPSetup({ code });
    await updateMFAPreference({ totp: 'PREFERRED' });
  }, []);

  const getMfaStatus = useCallback(async () => {
    try {
      const output = await fetchMFAPreference();
      const enabled = (output.enabled || []).includes('TOTP');
      const preferred = output.preferred || null;
      return { enabled, preferred };
    } catch {
      return { enabled: false, preferred: null };
    }
  }, []);

  const disableMfa = useCallback(async () => {
    await updateMFAPreference({ totp: 'DISABLED' });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        confirmMfa,
        register,
        confirmRegistration,
        logout,
        refreshProfile,
        setupTotp,
        verifyTotp,
        getMfaStatus,
        disableMfa,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
