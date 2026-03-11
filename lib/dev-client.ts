type Primitive = string | number | null;

type QueryFilter =
  | { op: "eq"; column: string; value: Primitive }
  | { op: "in"; column: string; values: Primitive[] }
  | { op: "gte"; column: string; value: Primitive }
  | { op: "lte"; column: string; value: Primitive };

type QueryState = {
  table: string;
  action: "select" | "insert" | "update" | "delete";
  selectText?: string;
  head?: boolean;
  countExact?: boolean;
  single?: boolean;
  filters: QueryFilter[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  values?: Record<string, unknown> | Record<string, unknown>[];
};

type QueryResult<T = unknown> = {
  data: T;
  count: number | null;
  error: { message: string } | null;
};

const DEV_SESSION_KEY = "subaycentral_dev_session";
const DEV_AUTH_EVENT = "subaycentral_dev_auth_changed";

function emitAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DEV_AUTH_EVENT));
}

function getSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEV_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { user: { id: string; email: string } };
  } catch {
    return null;
  }
}

function setSession(session: { user: { id: string; email: string } } | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(DEV_SESSION_KEY);
    emitAuthChanged();
    return;
  }
  window.localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session));
  emitAuthChanged();
}

class DevQueryBuilder<T = unknown> implements PromiseLike<QueryResult<T>> {
  private state: QueryState;

  constructor(table: string) {
    this.state = {
      table,
      action: "select",
      filters: [],
    };
  }

  select(selectText = "*", options?: { count?: "exact"; head?: boolean }) {
    this.state.action = "select";
    this.state.selectText = selectText;
    this.state.head = options?.head;
    this.state.countExact = options?.count === "exact";
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.state.action = "insert";
    this.state.values = values;
    return this.execute();
  }

  update(values: Record<string, unknown>) {
    this.state.action = "update";
    this.state.values = values;
    return this;
  }

  delete() {
    this.state.action = "delete";
    return this;
  }

  eq(column: string, value: Primitive) {
    this.state.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, values: Primitive[]) {
    this.state.filters.push({ op: "in", column, values });
    return this;
  }

  gte(column: string, value: Primitive) {
    this.state.filters.push({ op: "gte", column, value });
    return this;
  }

  lte(column: string, value: Primitive) {
    this.state.filters.push({ op: "lte", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.state.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(n: number) {
    this.state.limit = n;
    return this;
  }

  single() {
    this.state.single = true;
    return this.execute();
  }

  async execute() {
    const res = await fetch("/api/devdb/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.state),
    });
    const json = (await res.json()) as QueryResult<T>;
    return json;
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

export function createDevClient() {
  return {
    auth: {
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const res = await fetch("/api/devdb/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (json.error) {
          return { data: { user: null }, error: json.error };
        }
        const session = { user: json.data.user };
        setSession(session);
        return { data: { user: json.data.user }, error: null };
      },

      async signOut() {
        setSession(null);
        return { error: null };
      },

      async getSession() {
        const session = getSession();
        return { data: { session }, error: null };
      },

      onAuthStateChange(
        callback: (_event: string, session: { user: { id: string; email: string } } | null) => void
      ) {
        const handler = () => {
          const session = getSession();
          callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
        };
        window.addEventListener("storage", handler);
        window.addEventListener(DEV_AUTH_EVENT, handler);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                window.removeEventListener("storage", handler);
                window.removeEventListener(DEV_AUTH_EVENT, handler);
              },
            },
          },
        };
      },

      async updateUser({ password }: { password: string }) {
        const session = getSession();
        if (!session?.user?.id) {
          return { data: null, error: { message: "No signed-in user" } };
        }
        const { error } = await new DevQueryBuilder("profiles")
          .update({ password })
          .eq("id", session.user.id);
        return { data: null, error };
      },
    },

    from(table: string) {
      return new DevQueryBuilder(table);
    },
  };
}
