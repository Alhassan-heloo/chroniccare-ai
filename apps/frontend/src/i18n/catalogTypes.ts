export type LocaleShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string
    ? string
    : LocaleShape<T[Key]>;
};

export type TranslationValue = string | number;
export type TranslationVariables = Readonly<Record<string, TranslationValue>>;
export type Language = "ar" | "en";

type DotPath<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${DotPath<T[Key]>}`
      : never;
}[keyof T & string];

export type CatalogKey<T> = DotPath<T>;
