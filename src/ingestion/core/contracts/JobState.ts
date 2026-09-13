/**
 * JobState.ts
 * Máquina de Estados formal para Jobs de Ingestão de Dados de Segurança Pública.
 * Define estados inequívocos e matriz estrita de transições válidas.
 */

export type JobState =
  | 'pending'
  | 'running'
  | 'retrying'
  | 'succeeded'
  | 'succeeded_with_warnings'
  | 'failed'
  | 'cancelled'
  | 'stale'
  | 'blocked';

/** Mapeamento de compatibilidade com valores legados no banco de dados */
export const LegacyJobStateMap: Record<string, JobState> = {
  'QUEUED': 'pending',
  'pending': 'pending',
  'PROCESSING': 'running',
  'running': 'running',
  'RETRYING': 'retrying',
  'retrying': 'retrying',
  'COMPLETED': 'succeeded',
  'succeeded': 'succeeded',
  'succeeded_with_warnings': 'succeeded_with_warnings',
  'FAILED': 'failed',
  'failed': 'failed',
  'CANCELLED': 'cancelled',
  'cancelled': 'cancelled',
  'STALE': 'stale',
  'stale': 'stale',
  'BLOCKED': 'blocked',
  'blocked': 'blocked'
};

/**
 * Matriz estrita de transições permitidas na máquina de estados de Jobs.
 * Impede transições inválidas como succeeded -> running ou cancelled -> succeeded.
 */
export const ValidJobTransitions: Record<JobState, JobState[]> = {
  'pending': ['running', 'cancelled', 'blocked'],
  'running': ['succeeded', 'succeeded_with_warnings', 'failed', 'retrying', 'stale', 'cancelled'],
  'retrying': ['pending', 'running', 'failed', 'cancelled'],
  'stale': ['retrying', 'failed', 'pending', 'cancelled'],
  'blocked': ['pending', 'cancelled'],
  'succeeded': [], // Estado terminal (requer novo job ou reprocessamento explícito que recria/reseta para pending)
  'succeeded_with_warnings': [], // Estado terminal
  'failed': ['pending'], // Permitido apenas via reprocessamento oficial controlado
  'cancelled': [] // Estado terminal
};

export class JobStateMachine {
  /**
   * Normaliza qualquer string de status para o tipo JobState oficial.
   */
  public static normalize(status: string | null | undefined): JobState {
    if (!status) return 'pending';
    const upper = status.trim().toUpperCase();
    const exact = status.trim().toLowerCase();
    
    if (LegacyJobStateMap[status]) return LegacyJobStateMap[status];
    if (LegacyJobStateMap[upper]) return LegacyJobStateMap[upper];
    if (LegacyJobStateMap[exact]) return LegacyJobStateMap[exact];
    
    return 'pending';
  }

  /**
   * Valida se uma transição de estado é permitida pelas regras operacionais.
   */
  public static isValidTransition(currentState: string | JobState, nextState: string | JobState): boolean {
    const from = this.normalize(currentState);
    const to = this.normalize(nextState);

    // Mesma transição é permitida (no-op)
    if (from === to) return true;

    const allowedNext = ValidJobTransitions[from] || [];
    return allowedNext.includes(to);
  }

  /**
   * Executa a transição ou lança erro explicativo se a transição for inválida.
   */
  public static assertTransition(currentState: string | JobState, nextState: string | JobState, jobId?: string): JobState {
    const from = this.normalize(currentState);
    const to = this.normalize(nextState);

    if (!this.isValidTransition(from, to)) {
      const jobCtx = jobId ? ` no Job '${jobId}'` : '';
      throw new Error(
        `Transição de estado inválida${jobCtx}: não é permitido transitar de '${from}' para '${to}'. ` +
        `Transições permitidas a partir de '${from}': [${(ValidJobTransitions[from] || []).join(', ') || 'Nenhuma (Estado Terminal)'}].`
      );
    }

    return to;
  }

  /**
   * Converte o estado para formato legado do banco de dados (se necessário para escrita compatível).
   */
  public static toDbStatus(state: JobState): string {
    switch (state) {
      case 'pending': return 'QUEUED';
      case 'running': return 'PROCESSING';
      case 'succeeded': return 'COMPLETED';
      case 'succeeded_with_warnings': return 'COMPLETED'; // no DB compatível, qualidade fica em quality_status
      case 'failed': return 'FAILED';
      case 'cancelled': return 'CANCELLED';
      case 'stale': return 'FAILED';
      case 'blocked': return 'FAILED';
      case 'retrying': return 'QUEUED';
      default: return 'QUEUED';
    }
  }
}
