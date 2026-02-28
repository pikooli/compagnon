export function SplitLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <div className="w-1/2 overflow-y-auto border-r border-foreground/10">
        {left}
      </div>
      <div className="w-1/2 overflow-y-auto bg-foreground/[0.02]">
        {right}
      </div>
    </div>
  );
}
