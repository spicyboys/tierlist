export interface LiveUser {
  id: string;
  username: string;
  draggingItemId?: string | null;
}

export default function LiveUserBar({
  users,
  currentUserId,
  hostUserId,
}: {
  users: LiveUser[];
  currentUserId: string;
  hostUserId: string | null;
}) {
  return (
    <div className="border-b border-gray-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      {users.map((u) => {
        return (
          <span
            key={u.id}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
              u.id === hostUserId
                ? "bg-purple-900/50 text-purple-300 ring-1 ring-purple-500/30"
                : u.draggingItemId
                  ? "bg-yellow-900/50 text-yellow-300 ring-1 ring-yellow-500/30"
                  : "bg-gray-800 text-gray-300"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                u.draggingItemId ? "bg-yellow-400" : "bg-green-400"
              }`}
            />

            {u.username}
            {u.id === currentUserId && " (you)"}
            {u.id === hostUserId && " (host)"}
            {u.draggingItemId && u.id !== hostUserId && " - moving..."}
          </span>
        );
      })}
    </div>
  );
}
