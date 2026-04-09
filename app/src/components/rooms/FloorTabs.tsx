import { useRoomStore } from "../../stores/roomStore";

function floorLabel(floor: string): string {
  if (floor === "0") return "Zemin Kat";
  return `${floor}. Kat`;
}

export function FloorTabs() {
  const { activeFloor, setActiveFloor, getFloors } = useRoomStore();
  const floors = getFloors();

  return (
    <div className="flex gap-1.5 px-5 overflow-x-auto scrollbar-none">
      {/* All tab */}
      <TabButton
        id="tab-floor-all"
        label="Tümü"
        active={activeFloor === "all"}
        onClick={() => setActiveFloor("all")}
      />
      {floors.map((floor) => (
        <TabButton
          key={floor}
          id={`tab-floor-${floor}`}
          label={floorLabel(floor)}
          active={activeFloor === floor}
          onClick={() => setActiveFloor(floor)}
        />
      ))}
    </div>
  );
}

interface TabButtonProps {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ id, label, active, onClick }: TabButtonProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`
        px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap
        transition-all duration-150
        ${
          active
            ? "bg-[var(--accent)] text-white shadow-sm"
            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        }
      `}
    >
      {label}
    </button>
  );
}
