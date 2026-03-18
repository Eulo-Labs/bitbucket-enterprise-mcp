import type { PullRequest } from '../../bitbucket/types';

export function formatPr(pr: PullRequest) {
  return {
    id: pr.id,
    title: pr.title,
    description: pr.description,
    state: pr.state,
    author: pr.author.display_name,
    source_branch: pr.source.branch.name,
    destination_branch: pr.destination.branch.name,
    created_on: pr.created_on,
    updated_on: pr.updated_on,
    comment_count: pr.comment_count,
    task_count: pr.task_count,
    reviewers: pr.reviewers ? pr.reviewers.map((r) => r.display_name) : [],
    url: pr.links.html.href,
  };
}
