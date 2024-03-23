/**
 * QCraft type utils.
 */
export namespace QUtils {
  /**
   * Resolves true if the type is a union.
   */
  export type IsUnion<Type, Mirror = Type> = Type extends Type
    ? [Mirror] extends [Type]
      ? false
      : true
    : never;
}
