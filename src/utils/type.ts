export type MakeRequired<T, K extends keyof T> = Required<Pick<T, K>>;
