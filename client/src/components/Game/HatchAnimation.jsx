const HatchAnimation = ({ isHatching, onComplete, duration = 2000 }) => {
  const [stage, setStage] = useState("idle"); // idle, cracking, hatching, complete

  useEffect(() => {
    if (isHatching) {
      setStage("cracking");

      const crackTimer = setTimeout(() => {
        setStage("hatching");
      }, duration * 0.4);

      const hatchTimer = setTimeout(() => {
        setStage("complete");
        onComplete?.();
      }, duration * 0.8);

      return () => {
        clearTimeout(crackTimer);
        clearTimeout(hatchTimer);
      };
    } else {
      setStage("idle");
    }
  }, [isHatching, duration, onComplete]);

  const getEggContent = () => {
    switch (stage) {
      case "cracking":
        return (
          <div className="relative">
            <div className="w-32 h-40 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-6xl">
              🥚
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-32 bg-black bg-opacity-20 rounded-full animate-pulse"></div>
            </div>
            <div className="absolute -top-2 -left-2 w-6 h-6 bg-white bg-opacity-30 rounded-full animate-ping"></div>
          </div>
        );

      case "hatching":
        return (
          <div className="relative">
            <div className="w-32 h-40 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full flex items-center justify-center text-6xl opacity-50">
              🥚
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-4xl animate-bounce">🐣</div>
            </div>
            <div className="absolute inset-0 bg-yellow-200 bg-opacity-20 rounded-full animate-pulse"></div>
          </div>
        );

      case "complete":
        return <div className="text-6xl animate-bounce">🐥</div>;

      default:
        return (
          <div className="w-32 h-40 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-6xl animate-float">
            🥚
          </div>
        );
    }
  };

  const getStageText = () => {
    switch (stage) {
      case "cracking":
        return "Egg is cracking...";
      case "hatching":
        return "Something is emerging!";
      case "complete":
        return "New pet hatched!";
      default:
        return "Ready to hatch";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      {getEggContent()}
      <p className="text-white text-lg font-semibold text-center">
        {getStageText()}
      </p>

      {stage === "cracking" && (
        <div className="w-full max-w-xs bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-1000"
            style={{ width: "40%" }}
          ></div>
        </div>
      )}

      {stage === "hatching" && (
        <div className="w-full max-w-xs bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-1000"
            style={{ width: "80%" }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default HatchAnimation;
