"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    setError(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) setError(error.message);
      else alert("Check your email to confirm your account.");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", maxWidth: 400 }}>
      <h1>{isLogin ? "Login" : "Register"}</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={handleAuth} disabled={loading}>
        {loading ? "Loading..." : isLogin ? "Login" : "Register"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <p
        style={{ marginTop: 20, cursor: "pointer", color: "blue" }}
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin
          ? "Don't have an account? Register"
          : "Already have an account? Login"}
      </p>
    </div>
  );
}
