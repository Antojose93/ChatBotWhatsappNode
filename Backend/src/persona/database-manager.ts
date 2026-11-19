/** Application service that exposes CRUD and activation over PersonaDatabase. */
import type { Persona } from "./index.ts";
import { PersonaDatabase, type PersonaInput, type PersonaRecord } from "./persona-database.ts";

export class DatabasePersonaManager {
  private readonly store: PersonaDatabase;

  constructor(store: PersonaDatabase) {
    this.store = store;
  }

  list(): PersonaRecord[] { return this.store.list(); }
  get(id: string): PersonaRecord | undefined { return this.store.get(id); }
  getActive(): Persona & { id: string } { return this.store.toPersona(this.store.active()); }
  create(input: PersonaInput & { id: string }): PersonaRecord { return this.store.create(input); }
  update(id: string, input: PersonaInput): PersonaRecord { return this.store.update(id, input); }
  delete(id: string): void { this.store.delete(id); }
  activate(id: string): PersonaRecord { return this.store.setActive(id); }
  close(): void { this.store.close(); }
}

export function loadDatabasePersonaManager(): DatabasePersonaManager {
  return new DatabasePersonaManager(new PersonaDatabase());
}
