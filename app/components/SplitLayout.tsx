export function SplitLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <div className="w-1/2 overflow-y-auto bg-[#070d1f]">
        {left}
      </div>
      <div className="w-1/2 overflow-y-auto bg-[#070d1f] border-l border-[#1e2d4a]">
        {right}
      </div>
    </div>
  );
}
