"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Eye, EyeOff } from "lucide-react";

const fallbackPrograms = [
  { value: "BS Information Technology", label: "BS Information Technology" },
  { value: "BS Computer Science", label: "BS Computer Science" },
  { value: "BS Information Systems", label: "BS Information Systems" },
  { value: "BS Office Administration", label: "BS Office Administration" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [programOptions, setProgramOptions] = useState(fallbackPrograms);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [registerShowPassword, setRegisterShowPassword] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [program, setProgram] = useState(fallbackPrograms[0].value);
  const [section, setSection] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  useEffect(() => {
    async function loadPrograms() {
      const { data, error: programsError } = await supabase
        .from("programs")
        .select("name")
        .order("name", { ascending: true });

      if (programsError || !data || data.length === 0) return;

      const options = (data as { name: string }[])
        .map((row: { name: string }) => ({ value: row.name, label: row.name }))
        .filter((row: { value: string }) => Boolean(row.value));

      if (options.length === 0) return;

      setProgramOptions(options);
      setProgram(options[0].value);
    }

    loadPrograms();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Fetch role from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const role = profile?.role ?? "intern";
      router.replace(`/${role}`);
    }

    setLoading(false);
  }

  function resetRegisterForm() {
    setStudentId("");
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setProgram(programOptions[0]?.value ?? fallbackPrograms[0].value);
    setSection("");
    setContactNumber("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterShowPassword(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSuccess(null);

    if (registerPassword.length < 6) {
      setRegisterError("Password must be at least 6 characters.");
      return;
    }

    setRegisterLoading(true);

    const normalizedEmail = registerEmail.trim().toLowerCase();
    const fullName = [firstName.trim(), middleName.trim(), lastName.trim()]
      .filter(Boolean)
      .join(" ");

    if (!fullName) {
      setRegisterError("Please provide your first name and last name.");
      setRegisterLoading(false);
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: registerPassword,
      options: {
        data: {
          role: "intern",
          full_name: fullName,
          first_name: firstName.trim(),
          middle_name: middleName.trim(),
          last_name: lastName.trim(),
          student_id: studentId.trim(),
          program,
          section: section.trim(),
          phone: contactNumber.trim(),
        },
      },
    });

    if (signUpError) {
      setRegisterError(signUpError.message);
      setRegisterLoading(false);
      return;
    }

    if (signUpData.user && signUpData.session) {
      const profileUpdate = {
        student_id: studentId.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        program,
        section: section.trim(),
        phone: contactNumber.trim(),
      };

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", signUpData.user.id);

      // Fallback for older schemas that may not yet contain new columns.
      if (profileUpdateError) {
        await supabase
          .from("profiles")
          .update({
            student_id: studentId.trim(),
            phone: contactNumber.trim(),
          })
          .eq("id", signUpData.user.id);
      }

      router.replace("/intern");
      return;
    }

    setEmail(normalizedEmail);
    setRegisterSuccess("Account created. Please verify your email, then sign in.");
    setRegisterLoading(false);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome to SUbAyCentral</h2>
        <p className="text-slate-500 text-sm mb-6">
          Sign in to your account to continue
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Password<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-2">
            Sign In
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              resetRegisterForm();
              setRegisterOpen(true);
            }}
          >
            Create Intern Account
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Contact your administrator if you need to reset your account's password.
        </p>
      </div>

      <Modal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Student Registration"
        maxWidth="lg"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            label="Student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. 2026-0001"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Middle Name"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              options={programOptions}
              required
            />
            <Input
              label="Section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. 3A"
              required
            />
          </div>

          <Input
            label="Contact Number"
            type="tel"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder="e.g. 09171234567"
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={registerEmail}
            onChange={(e) => setRegisterEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Password<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative">
              <input
                type={registerShowPassword ? "text" : "password"}
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoComplete="new-password"
                minLength={6}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setRegisterShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {registerShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {registerError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
              {registerError}
            </div>
          )}

          {registerSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm text-emerald-700">
              {registerSuccess}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRegisterOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={registerLoading}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
