import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-[15px] text-text-secondary">
          Create an account by signing in with Google.
        </p>
        <p className="mt-3 text-[14px]">
          <Link
            href="/sign-in"
            className="font-semibold text-accent hover:underline"
          >
            Go to sign in &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
