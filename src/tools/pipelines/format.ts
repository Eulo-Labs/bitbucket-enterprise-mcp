import type { Pipeline } from '../../bitbucket/types';

export function formatPipeline(p: Pipeline) {
  return {
    uuid: p.uuid,
    build_number: p.build_number,
    state: p.state.name,
    result: p.state.result?.name ?? null,
    created_on: p.created_on,
    duration_seconds: p.duration_in_seconds,
    ref: p.target.ref_name,
    commit: p.target.commit?.hash?.slice(0, 12),
    trigger: p.trigger.name,
  };
}
