/**
 * 树结构工具。
 * 模块职责：将平铺列表构建为树、展开树、收集节点 id。
 */

/** 带 children 的树节点类型。 */
export type WithChildren<T> = T & { children: WithChildren<T>[] };

/** 树节点最小约束。 */
export interface TreeItem {
  id: number;
  parentId: number;
  sort?: number;
}

/**
 * 将平铺列表构建为树。
 * @param list 平铺节点数组
 * @param rootParentId 根节点的 parentId（默认 0）
 * @returns 树形数组（同层按 sort 升序、再按 id 升序）
 */
export function buildTree<T extends TreeItem>(list: T[], rootParentId = 0): WithChildren<T>[] {
  const nodeMap = new Map<number, WithChildren<T>>();
  list.forEach((item) => {
    nodeMap.set(item.id, { ...item, children: [] });
  });

  const roots: WithChildren<T>[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId === rootParentId) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // 父节点缺失（数据异常）时按根节点处理，避免数据丢失
        roots.push(node);
      }
    }
  });

  sortNodes(roots);
  return roots;
}

/** 递归排序树节点。 */
function sortNodes<T extends TreeItem>(nodes: WithChildren<T>[]): void {
  nodes.sort((a, b) => {
    const sortDiff = (a.sort ?? 0) - (b.sort ?? 0);
    return sortDiff !== 0 ? sortDiff : a.id - b.id;
  });
  nodes.forEach((node) => sortNodes(node.children));
}

/**
 * 深度优先展开树为平铺数组。
 * @param nodes 树节点数组
 * @returns 平铺数组（父节点在前）
 */
export function flattenTree<T extends TreeItem>(nodes: WithChildren<T>[]): T[] {
  const result: T[] = [];
  const walk = (items: WithChildren<T>[]): void => {
    items.forEach((item) => {
      const { children, ...rest } = item;
      result.push(rest as unknown as T);
      if (children.length > 0) {
        walk(children);
      }
    });
  };
  walk(nodes);
  return result;
}

/**
 * 收集树中全部节点 id。
 * @param nodes 树节点数组
 * @returns id 数组
 */
export function collectIds<T extends TreeItem>(nodes: WithChildren<T>[]): number[] {
  return flattenTree(nodes).map((node) => node.id);
}
