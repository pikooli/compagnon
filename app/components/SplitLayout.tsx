export function SplitLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <div className="w-1/2 overflow-y-auto bg-white">
        {left}
      </div>
      <div className="w-1/2 overflow-y-auto border-l border-slate-200 bg-slate-50">
        {right}
      </div>
    </div>
  );
}
