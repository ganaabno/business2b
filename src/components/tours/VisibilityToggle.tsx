// src/components/tours/VisibilityToggle.tsx
interface VisibilityToggleProps {
  showToUser: boolean;
  showInProvider: boolean;
  onUserChange: (v: boolean) => void;
  onProviderChange: (v: boolean) => void;
}

export default function VisibilityToggle({
  showToUser,
  showInProvider,
  onUserChange,
  onProviderChange,
}: VisibilityToggleProps) {
  return (
    <div className="flex gap-4 items-center">
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={showToUser}
          onChange={(e) => onUserChange(e.target.checked)}
          className="mr-1"
        />
        User
      </label>
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={showInProvider}
          onChange={(e) => onProviderChange(e.target.checked)}
          className="mr-1"
        />
        Provider
      </label>
    </div>
  );
}
