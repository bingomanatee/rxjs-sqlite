/**
 * SQLite Query Builder for RxDB
 * Translates RxDB Mango queries to SQLite queries
 */
import type { FilledMangoQuery, MangoQuerySelector } from 'rxdb';

/**
 * Builds a SQLite query from a Mango query
 */
export function getSQLiteQueryBuilderFromMangoQuery<RxDocType>(
  mangoQuery: FilledMangoQuery<RxDocType>,
  tableName: string,
  isCountQuery = false
): { query: string; params: any[] } {
  const params: any[] = [];
  
  // Start building the query
  let query = isCountQuery
    ? `SELECT COUNT(*) as count FROM ${tableName}`
    : `SELECT id, data FROM ${tableName}`;
  
  // Build the WHERE clause
  const whereClause = buildWhereClause(mangoQuery.selector, params);
  if (whereClause) {
    query += ` WHERE ${whereClause}`;
  }
  
  // Add sorting if not a count query
  if (!isCountQuery && mangoQuery.sort && mangoQuery.sort.length > 0) {
    const sortParts = mangoQuery.sort.map(sortPart => {
      const key = Object.keys(sortPart)[0];
      const direction = sortPart[key] === 'asc' ? 'ASC' : 'DESC';
      
      // For primary fields, use the column directly
      if (key === 'id' || key === '_deleted' || key === '_rev') {
        return `${key} ${direction}`;
      }
      
      // For nested fields, use JSON_EXTRACT
      return `JSON_EXTRACT(data, '$.${key}') ${direction}`;
    });
    
    query += ` ORDER BY ${sortParts.join(', ')}`;
  }
  
  // Add skip and limit if not a count query
  if (!isCountQuery) {
    if (mangoQuery.skip && mangoQuery.skip > 0) {
      query += ` OFFSET ${mangoQuery.skip}`;
    }
    
    if (mangoQuery.limit) {
      query += ` LIMIT ${mangoQuery.limit}`;
    }
  }
  
  return { query, params };
}

/**
 * Builds a WHERE clause from a Mango query selector
 */
function buildWhereClause(
  selector: MangoQuerySelector<any>,
  params: any[]
): string {
  const conditions: string[] = [];
  
  // Process each field in the selector
  for (const field in selector) {
    if (field.startsWith('$')) {
      // Handle logical operators
      switch (field) {
        case '$and':
          const andConditions = selector[field].map((subSelector: MangoQuerySelector<any>) => {
            return `(${buildWhereClause(subSelector, params)})`;
          });
          conditions.push(andConditions.join(' AND '));
          break;
          
        case '$or':
          const orConditions = selector[field].map((subSelector: MangoQuerySelector<any>) => {
            return `(${buildWhereClause(subSelector, params)})`;
          });
          conditions.push(orConditions.join(' OR '));
          break;
          
        case '$not':
          conditions.push(`NOT (${buildWhereClause(selector[field], params)})`);
          break;
          
        case '$nor':
          const norConditions = selector[field].map((subSelector: MangoQuerySelector<any>) => {
            return `(${buildWhereClause(subSelector, params)})`;
          });
          conditions.push(`NOT (${norConditions.join(' OR ')})`);
          break;
      }
    } else {
      // Handle field conditions
      const condition = buildFieldCondition(field, selector[field], params);
      if (condition) {
        conditions.push(condition);
      }
    }
  }
  
  return conditions.join(' AND ');
}

/**
 * Builds a condition for a specific field
 */
function buildFieldCondition(
  field: string,
  condition: any,
  params: any[]
): string {
  // Handle special fields
  if (field === 'id' || field === '_deleted' || field === '_rev') {
    return buildSpecialFieldCondition(field, condition, params);
  }
  
  // Handle regular fields using JSON_EXTRACT
  return buildJsonFieldCondition(field, condition, params);
}

/**
 * Builds a condition for a special field (id, _deleted, _rev)
 */
function buildSpecialFieldCondition(
  field: string,
  condition: any,
  params: any[]
): string {
  if (typeof condition === 'object') {
    // Handle operators
    return buildOperatorCondition(field, condition, params, false);
  } else {
    // Simple equality
    params.push(condition);
    return `${field} = ?`;
  }
}

/**
 * Builds a condition for a JSON field
 */
function buildJsonFieldCondition(
  field: string,
  condition: any,
  params: any[]
): string {
  if (typeof condition === 'object') {
    // Handle operators
    return buildOperatorCondition(field, condition, params, true);
  } else {
    // Simple equality
    params.push(condition);
    return `JSON_EXTRACT(data, '$.${field}') = ?`;
  }
}

/**
 * Builds conditions for operators ($eq, $gt, etc.)
 */
function buildOperatorCondition(
  field: string,
  condition: any,
  params: any[],
  isJsonField: boolean
): string {
  const fieldExpr = isJsonField ? `JSON_EXTRACT(data, '$.${field}')` : field;
  const conditions: string[] = [];
  
  for (const operator in condition) {
    const value = condition[operator];
    
    switch (operator) {
      case '$eq':
        params.push(value);
        conditions.push(`${fieldExpr} = ?`);
        break;
        
      case '$ne':
        params.push(value);
        conditions.push(`${fieldExpr} != ?`);
        break;
        
      case '$gt':
        params.push(value);
        conditions.push(`${fieldExpr} > ?`);
        break;
        
      case '$gte':
        params.push(value);
        conditions.push(`${fieldExpr} >= ?`);
        break;
        
      case '$lt':
        params.push(value);
        conditions.push(`${fieldExpr} < ?`);
        break;
        
      case '$lte':
        params.push(value);
        conditions.push(`${fieldExpr} <= ?`);
        break;
        
      case '$in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(',');
          value.forEach(v => params.push(v));
          conditions.push(`${fieldExpr} IN (${placeholders})`);
        } else {
          // Empty $in always returns false
          conditions.push('0 = 1');
        }
        break;
        
      case '$nin':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(',');
          value.forEach(v => params.push(v));
          conditions.push(`${fieldExpr} NOT IN (${placeholders})`);
        } else {
          // Empty $nin always returns true
          conditions.push('1 = 1');
        }
        break;
        
      case '$exists':
        if (value) {
          conditions.push(`${fieldExpr} IS NOT NULL`);
        } else {
          conditions.push(`${fieldExpr} IS NULL`);
        }
        break;
        
      case '$type':
        // SQLite doesn't have good type checking, so we approximate
        if (value === 'string') {
          conditions.push(`json_type(${fieldExpr}) = 'text'`);
        } else if (value === 'number') {
          conditions.push(`(json_type(${fieldExpr}) = 'integer' OR json_type(${fieldExpr}) = 'real')`);
        } else if (value === 'boolean') {
          conditions.push(`json_type(${fieldExpr}) = 'boolean'`);
        } else if (value === 'object') {
          conditions.push(`json_type(${fieldExpr}) = 'object'`);
        } else if (value === 'array') {
          conditions.push(`json_type(${fieldExpr}) = 'array'`);
        } else if (value === 'null') {
          conditions.push(`json_type(${fieldExpr}) = 'null'`);
        }
        break;
        
      case '$regex':
        // SQLite doesn't support regex directly, use LIKE as an approximation
        // This is a limitation and won't work for all regex patterns
        let pattern = value;
        if (typeof pattern === 'object' && pattern instanceof RegExp) {
          pattern = pattern.source;
        }
        
        // Convert simple regex patterns to LIKE patterns
        // This is very limited and only works for simple cases
        let likePattern = pattern.replace(/^\^/, '').replace(/\$$/, '');
        likePattern = `%${likePattern}%`;
        
        params.push(likePattern);
        conditions.push(`${fieldExpr} LIKE ?`);
        break;
        
      case '$mod':
        if (Array.isArray(value) && value.length === 2) {
          const divisor = value[0];
          const remainder = value[1];
          conditions.push(`CAST(${fieldExpr} AS INTEGER) % ${divisor} = ${remainder}`);
        }
        break;
    }
  }
  
  return conditions.join(' AND ');
}
