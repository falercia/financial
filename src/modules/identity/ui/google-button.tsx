import { SubmitButton } from "@/components/ui/button";
import { signInWithGoogle } from "../application/auth-actions";

export function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton variant="secondary" className="min-h-12 w-full text-[15px] font-semibold" pendingLabel="Abrindo o Google…">
        Continuar com Google
      </SubmitButton>
    </form>
  );
}

export function Divider() {
  return (
    <div className="text-muted flex items-center gap-3 text-[12.5px]">
      <span className="bg-line-strong h-px flex-1" />
      ou
      <span className="bg-line-strong h-px flex-1" />
    </div>
  );
}
