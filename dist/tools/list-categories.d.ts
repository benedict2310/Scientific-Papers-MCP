import { CategoryList } from '../types/papers.js';
import { ListCategoriesParams } from '../config/schemas.js';
export declare function listCategories(params: ListCategoriesParams): Promise<CategoryList>;
