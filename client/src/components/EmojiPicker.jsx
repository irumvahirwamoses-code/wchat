/**
 * Lightweight emoji picker (no dependency — Wchat is meant for low data usage).
 * A curated, grouped set of the most used emoji; clicking inserts at the caret.
 */
const GROUPS = [
  {
    id: 'faces',
    label: 'Smileys',
    emoji: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
      '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '🤪', '🤨',
      '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕',
      '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '🤗', '🤔', '🤭', '🤫',
      '😴', '🤤', '😪', '😮', '😯', '🥶', '😐', '😬', '🙄', '😯',
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    emoji: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤙', '👋', '🖐️', '✋',
      '👏', '🙌', '🤝', '🙏', '💪', '🦾', '❤️', '🧡', '💛', '💚',
      '💙', '💜', '🖤', '💔', '❣️', '💕', '💯', '🔥', '⭐', '🌟',
      '✨', '⚡', '🎉', '🎊', '🎁', '🏆', '🥇', '🎯', '💡', '📌',
    ],
  },
  {
    id: 'nature',
    label: 'Nature & food',
    emoji: [
      '🌞', '🌙', '⛅', '🌈', '☀️', '🌤️', '🌍', '🌱', '🌳', '🌴',
      '🍌', '🥑', '🍑', '🍓', '🍇', '🍉', '🍍', '🥭', '☕', '🍺',
      '🥤', '🍲', '🍚', '🍖', '🍗', '🧉',
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    emoji: [
      '📱', '💻', '🎧', '🎮', '📚', '📖', '✏️', '🖊️', '🗓️', '📅',
      '⏰', '💰', '💵', '💳', '📈', '📉', '🏠', '🚗', '🚌', '✈️',
      '🎓', '🪪', '🎫', '🎵', '🎤', '🎥', '📷', '🔍', '🔒', '🔑',
    ],
  },
  {
    id: 'flags',
    label: 'Flags',
    emoji: [
      '🇷🇼', '🇺🇬', '🇰🇪', '🇹🇿', '🇧🇮', '🇨🇩', '🇪🇹', '🇿🇦', '🇳🇬', '🇬🇭',
      '🇺🇸', '🇬🇧', '🇫🇷', '🇨🇦', '🇩🇪', '🇮🇳', '🇨🇳', '🇧🇷', '🇦🇪', '🇪🇺',
      '🏳️', '🏴', '🚩', '🏁',
    ],
  },
]

export default function EmojiPicker({ onPick, onClose }) {
  return (
    <div className="animate-scale-in absolute bottom-12 right-0 z-40 w-[min(20rem,90vw)] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Emoji
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-500 transition hover:text-zinc-200"
        >
          Close
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto px-2 pb-2">
        {GROUPS.map((group) => (
          <section key={group.id} className="pt-2">
            <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {group.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.emoji.map((symbol, index) => (
                <button
                  key={`${group.id}-${index}`}
                  type="button"
                  onClick={() => onPick(symbol)}
                  className="rounded-md p-1 text-lg leading-none transition hover:bg-zinc-800"
                  title={symbol}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
