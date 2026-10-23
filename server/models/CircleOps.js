import mongoose from 'mongoose';

/**
 * Circle Operations — group automation & resource management.
 *
 * A Circle is treated as a *system* made of resources (its members). Like an
 * automation manager, the admin can act on the whole group at once instead of
 * member by member:
 *
 *   • **start**  → bring every resource up together.
 *   • **stop**   → bring every resource down together.
 *   • **restart**→ bring everything down then up again. Any resource that is
 *                   still down after the restart is a *failed restart*, and a
 *                   Circle that cannot be fully brought back up is **broken**.
 *   • **move**   → hand the Circle to another member so a different "system"
 *                   runs it (high availability of the group itself).
 *
 * Resource status is derived from real presence (`user.isOnline`) so the panel
 * never shows a made-up number; only the restart bookkeeping is stored.
 */
export const OPS_STATES = ['running', 'stopped', 'broken'];
export const OPS_ACTIONS = ['created', 'start', 'stop', 'restart', 'move', 'broken'];

const circleOpsSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      unique: true,
    },
    state: {
      type: String,
      enum: { values: OPS_STATES, message: 'Invalid ops state: {VALUE}' },
      default: 'running',
    },
    /**
     * Resources that could not be brought up by the last restart. Each entry
     * stays until a later restart clears it, which is what keeps a Circle
     * marked broken until an admin actually fixes it.
     */
    failed: {
      type: [
        {
          member: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          reason: { type: String, default: 'still offline after restart' },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    /** Every lifecycle action, kept automatically for review. */
    history: {
      type: [
        {
          actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          action: { type: String, enum: OPS_ACTIONS },
          from: { type: String },
          to: { type: String },
          note: { type: String, maxlength: 200 },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const CircleOps = mongoose.model('CircleOps', circleOpsSchema);

export default CircleOps;
