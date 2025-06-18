import { type SchemaTypeDefinition } from 'sanity'
import recipe from './recipe'
import mealPlan from './mealPlan'
import user from './user'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [recipe, mealPlan, user],
}
