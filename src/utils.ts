/**
 * Superstate type utils.
 */
export namespace SuperstateUtils {
  /**
   * Resolves true if the type is a union.
   */
  export type IsUnion<Type, Mirror = Type> = Type extends Type
    ? [Mirror] extends [Type]
      ? false
      : true
    : never;

  /**
   * Omits empty object values from a type.
   */
  export type OmitEmptyObjects<Type> = {
    [Key in keyof Type as keyof Type[Key] extends never
      ? never
      : Key]: Type[Key];
  };
}
