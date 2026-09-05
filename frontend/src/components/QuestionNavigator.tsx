interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answeredIndexes: Set<number>;
  onNavigate: (index: number) => void;
}

export default function QuestionNavigator({
  totalQuestions,
  currentIndex,
  answeredIndexes,
  onNavigate,
}: QuestionNavigatorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Question Navigator</h3>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const answered = answeredIndexes.has(idx);
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={idx}
              onClick={() => onNavigate(idx)}
              className={`h-9 w-9 rounded-lg text-sm font-medium border transition-colors ${
                isCurrent
                  ? "border-primary bg-primary text-white"
                  : answered
                  ? "border-green-300 bg-green-100 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-green-100 border border-green-300 inline-block" /> Answered
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-gray-50 border border-gray-200 inline-block" /> Not answered
        </div>
      </div>
    </div>
  );
}
