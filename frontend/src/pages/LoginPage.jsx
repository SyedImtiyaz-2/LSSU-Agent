import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Loader2 } from "lucide-react";
import { login, signup } from "../api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-5">
            <Mic className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-2xl font-bold text-white">LSSU Session Agent</h1>
          <p className="text-sm text-neutral-500 mt-2">
            Requirements gathering platform
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-neutral-400 mb-2 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-base text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
              placeholder="you@lssu.edu"
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-2 font-medium">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-base text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black text-base font-semibold rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSignup ? "Create Account" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 mt-8">
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsSignup(!isSignup);
              setError("");
            }}
            className="text-white font-medium hover:underline"
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}
