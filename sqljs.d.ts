declare module "sql.js" {
  interface Statement {
    get(params?: any[]): any;
    all(params?: any[]): any[];
    run(params?: any[]): this;
    free(): void;
  }

  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): any[];
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    (config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
    Database: new (data?: Uint8Array) => Database;
  }

  const initSqlJs: SqlJsStatic;
  export default initSqlJs;
}