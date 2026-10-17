import { NotFoundMessage } from "@/components/not-found-message";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
      <NotFoundMessage />
    </main>
  );
}
