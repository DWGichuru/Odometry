import SignUpForm from "@/components/auth/SignUpForm";

export default function SignUpPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-md">
        <div className="mb-8 text-center">
          <h1 className="text-[26px] font-bold tracking-tight leading-tight">
            Odometry
          </h1>
          <p className="mt-2 text-[14px] text-muted">Create your account</p>
        </div>

        <SignUpForm />
      </div>
    </div>
  );
}
