// Block types for the renderers. Import from the DSL module directly, never the @ifiok/core root:
// the root re-exports the verifier (mathjs, KaTeX), which must not reach the lesson shell (02 §7).
import type { Block } from "@ifiok/core/dsl/schema";

export type { Block };
export type BlockOf<T extends Block["type"]> = Extract<Block, { type: T }>;
export type CheckpointItem<T extends BlockOf<"checkpoint">["item"]["type"]> = Extract<
  BlockOf<"checkpoint">["item"],
  { type: T }
>;
