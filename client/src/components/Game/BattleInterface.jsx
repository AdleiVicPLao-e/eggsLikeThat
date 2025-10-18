import PetCard from "../Pets/PetCard";

const BattleInterface = ({ playerPets, opponentPets, onBattleComplete }) => {
  const [battleLog, setBattleLog] = useState([]);
  const [currentTurn, setCurrentTurn] = useState("player");
  const [isBattling, setIsBattling] = useState(false);

  const addToLog = (message) => {
    setBattleLog((prev) => [...prev, { message, timestamp: Date.now() }]);
  };

  const simulateBattle = async () => {
    setIsBattling(true);
    addToLog("Battle started!");

    // Simple battle simulation
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (currentTurn === "player") {
        addToLog(`Player's pet attacks!`);
        setCurrentTurn("opponent");
      } else {
        addToLog(`Opponent's pet attacks!`);
        setCurrentTurn("player");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    addToLog("Battle complete!");
    setIsBattling(false);
    onBattleComplete?.();
  };

  useEffect(() => {
    if (playerPets.length > 0 && opponentPets.length > 0) {
      simulateBattle();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Battle Arena */}
      <div className="grid grid-cols-2 gap-8">
        {/* Player Side */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-blue-400 text-center">
            Your Team
          </h3>
          <div className="grid gap-4">
            {playerPets.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        </div>

        {/* Opponent Side */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-red-400 text-center">
            Opponent
          </h3>
          <div className="grid gap-4">
            {opponentPets.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        </div>
      </div>

      {/* Battle Log */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-lg font-bold text-white mb-3">Battle Log</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {battleLog.map((entry, index) => (
            <div key={index} className="text-sm text-gray-300">
              {entry.message}
            </div>
          ))}
          {isBattling && (
            <div className="text-sm text-gray-400 animate-pulse">
              Battle in progress...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BattleInterface;
