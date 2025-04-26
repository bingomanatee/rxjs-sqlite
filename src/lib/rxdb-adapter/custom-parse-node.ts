/**
 * Custom parseNode function to handle special cases like unary operators
 */

/**
 * Parse a query node into a SQL string
 * @param node The query node to parse
 * @param params The parameters array to populate
 * @returns The SQL string
 */
export function customParseNode(node: any, params: any[]): string {
  // Handle null or undefined
  if (!node) return '1=1';

  // Handle string (already parsed)
  if (typeof node === 'string') return node;

  // Handle unary operators like IS NULL
  if (node.isUnary && node.op) {
    return `${node.field} ${node.op}`;
  }

  // Handle AND/OR operators with args array (from atmo-db)
  if (node.op === 'AND' && Array.isArray(node.args)) {
    const conditions = node.args
      .map(subNode => customParseNode(subNode, params))
      .filter(Boolean);

    if (conditions.length === 0) return '1=1';
    if (conditions.length === 1) return conditions[0];

    return `(${conditions.join(' AND ')})`;
  }

  if (node.op === 'OR' && Array.isArray(node.args)) {
    const conditions = node.args
      .map(subNode => customParseNode(subNode, params))
      .filter(Boolean);

    if (conditions.length === 0) return '1=1';
    if (conditions.length === 1) return conditions[0];

    return `(${conditions.join(' OR ')})`;
  }

  // Handle binary operators
  if (node.field && node.op && node.value !== undefined) {
    // Special handling for IN and NOT IN operators
    if (node.op === 'IN' || node.op === 'NOT IN') {
      if (Array.isArray(node.value)) {
        const placeholders = node.value.map(() => '?').join(', ');
        node.value.forEach(val => params.push(val));
        return `${node.field} ${node.op} (${placeholders})`;
      }
    }

    // Standard binary operator
    params.push(node.value);
    return `${node.field} ${node.op} ?`;
  }

  // Handle AND conditions
  if (node.and && Array.isArray(node.and)) {
    const conditions = node.and
      .map(subNode => customParseNode(subNode, params))
      .filter(Boolean);

    if (conditions.length === 0) return '1=1';
    if (conditions.length === 1) return conditions[0];

    return `(${conditions.join(' AND ')})`;
  }

  // Handle OR conditions
  if (node.or && Array.isArray(node.or)) {
    const conditions = node.or
      .map(subNode => customParseNode(subNode, params))
      .filter(Boolean);

    if (conditions.length === 0) return '1=1';
    if (conditions.length === 1) return conditions[0];

    return `(${conditions.join(' OR ')})`;
  }

  // Handle NOT conditions
  if (node.not) {
    const condition = customParseNode(node.not, params);
    return `NOT (${condition})`;
  }

  // Handle NOT operator from atmo-db
  if (node.op === 'NOT') {
    if (node.arg) {
      const condition = customParseNode(node.arg, params);
      return `NOT (${condition})`;
    } else if (Array.isArray(node.args) && node.args.length > 0) {
      const condition = customParseNode(node.args[0], params);
      return `NOT (${condition})`;
    }
  }

  // Fallback for unknown node types
  console.warn('Unknown node type:', node);
  return '1=1';
}
