import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'mealPlan',
  title: 'Meal Plan',
  type: 'document',
  fields: [
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'recipe',
      title: 'Recipe',
      type: 'reference',
      to: [{ type: 'recipe' }],
    }),
    defineField({
      name: 'note',
      title: 'Note',
      type: 'text',
      description: 'For leftovers or other meal notes',
    }),
    defineField({
      name: 'user',
      title: 'Created By',
      type: 'reference',
      to: [{ type: 'user' }],
    }),
  ],
})
