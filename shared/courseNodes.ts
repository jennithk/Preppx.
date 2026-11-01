export const COURSE_NODE_TYPES = ['subject', 'unit', 'topic', 'lesson'] as const;

export type CourseNodeType = (typeof COURSE_NODE_TYPES)[number];

export type CourseNodeSummary = {
  id: string;
  course_id: string;
  parent_id: string | null;
  node_type: CourseNodeType;
  title: string;
};

const allowedChildren: Record<CourseNodeType | 'root', readonly CourseNodeType[]> = {
  root: ['subject', 'unit'],
  subject: ['unit'],
  unit: ['topic'],
  topic: ['lesson'],
  lesson: [],
};

export function hasValidParentType(nodeType: CourseNodeType, parentType: CourseNodeType | null) {
  const allowedParents = parentType
    ? allowedChildren[parentType]
    : allowedChildren.root;
  return allowedParents.includes(nodeType);
}

export function isValidCourseNodeTree(nodes: readonly CourseNodeSummary[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) return false;
  const subjectRoots = nodes.filter((node) => node.node_type === 'subject' && node.parent_id === null);
  if (new Set(subjectRoots.map((node) => node.course_id)).size !== subjectRoots.length) return false;
  const coursesWithSubjectRoot = new Set(subjectRoots.map((node) => node.course_id));

  for (const node of nodes) {
    if (!node.course_id || !node.title.trim()) return false;
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (node.parent_id && !parent) return false;
    if (parent && parent.course_id !== node.course_id) return false;
    if (!hasValidParentType(node.node_type, parent?.node_type ?? null)) return false;
    if (node.node_type === 'unit' && coursesWithSubjectRoot.has(node.course_id) && !parent) return false;

    const visited = new Set([node.id]);
    let ancestor = parent;
    while (ancestor) {
      if (visited.has(ancestor.id)) return false;
      visited.add(ancestor.id);
      ancestor = ancestor.parent_id ? byId.get(ancestor.parent_id) : undefined;
    }
  }
  return true;
}

export function orderCourseNodes<T extends { id: string; parent_id: string | null }>(nodes: readonly T[]) {
  const children = new Map<string | null, T[]>();
  for (const node of nodes) {
    const siblings = children.get(node.parent_id) ?? [];
    siblings.push(node);
    children.set(node.parent_id, siblings);
  }

  const ordered: Array<{ node: T; depth: number }> = [];
  const visited = new Set<string>();
  const visit = (node: T, depth: number) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    ordered.push({ node, depth });
    for (const child of children.get(node.id) ?? []) visit(child, depth + 1);
  };

  for (const root of children.get(null) ?? []) visit(root, 0);
  for (const node of nodes) visit(node, 0);
  return ordered;
}

export function getCourseNodeLabel(node: CourseNodeSummary, nodes: readonly CourseNodeSummary[]) {
  const byId = new Map(nodes.map((candidate) => [candidate.id, candidate]));
  const labels = [node.title];
  const visited = new Set([node.id]);
  let parent = node.parent_id ? byId.get(node.parent_id) : undefined;
  while (parent && !visited.has(parent.id)) {
    visited.add(parent.id);
    labels.push(parent.title);
    parent = parent.parent_id ? byId.get(parent.parent_id) : undefined;
  }
  return labels.reverse().join(' > ');
}
