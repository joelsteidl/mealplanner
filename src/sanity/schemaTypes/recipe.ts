import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'recipe',
  title: 'Recipe',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Original Recipe URL',
      type: 'url',
    }),
    defineField({
      name: 'rating',
      title: 'Rating',
      type: 'number',
      validation: (Rule) => Rule.min(1).max(5),
      options: {
        list: [1, 2, 3, 4, 5],
      },
    }),
    defineField({
      name: 'difficulty',
      title: 'Difficulty',
      type: 'string',
      options: {
        list: ['Easy', 'Medium', 'Hard'],
      },
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        layout: 'tags',
        list: [
          { title: 'Friends Over', value: 'friends-over' },
          { title: 'Take a Meal', value: 'take-a-meal' },
          { title: 'Gluten Free', value: 'gluten-free' },
          { title: 'Vegetarian', value: 'vegetarian' },
        ],
      },
    }),
    defineField({
      name: 'ingredients',
      title: 'Ingredients',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'directions',
      title: 'Directions',
      type: 'array',
      of: [{ type: 'text' }],
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
    }),
    defineField({
      name: 'timesCooked',
      title: 'Times Cooked',
      type: 'number',
      initialValue: 0,
    }),
    defineField({
      name: 'lastCooked',
      title: 'Last Cooked',
      type: 'datetime',
    }),
    defineField({
      name: 'cookHistory',
      title: 'Cooking History',
      type: 'array',
      of: [{ type: 'datetime' }],
    }),
  ],
})
