import { AGENT_COLORS } from "../lib/colors";

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selectedColor, onSelect }: ColorPickerProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {AGENT_COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125"
          style={{
            backgroundColor: color,
            borderColor: color === selectedColor ? "#ffffff" : "transparent",
          }}
        />
      ))}
    </div>
  );
}
