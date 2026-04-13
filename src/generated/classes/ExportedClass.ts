export class ExportedClass {
  public static fromObject<T extends ExportedClass>(
    this: new () => T,
    value: Partial<T>,
  ): T {
    const instance = new this();
    if (value && typeof value === 'object') {
      Object.assign(instance, value);
    }
    return instance;
  }
}
