import { Youtube } from "lucide-react";

export function Header() {
  return (
    <header className="w-full py-6 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl glow-effect">
            <Youtube className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">TubeTransfer</h1>
            <p className="text-xs text-muted-foreground">Channel Migration Tool</p>
          </div>
        </div>
      </div>
    </header>
  );
}
