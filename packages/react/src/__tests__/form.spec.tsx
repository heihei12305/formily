import React, { useEffect } from 'react'
import { render } from '@testing-library/react'
import { createForm, ObjectField } from '@formily/core'
import { batch } from '@formily/reactive'

import {
  FormProvider,
  VoidField,
  Field,
  createSchemaField,
  observer,
  useField,
  ExpressionScope,
} from '../'
import { FormConsumer } from '../components'
import { useParentForm } from '../hooks'

test('render form', () => {
  const form = createForm()

  const schema = {
    type: 'object',
    properties: {
      record: {
        type: 'object',
        'x-component': 'Container',
        properties: {
          fieldA: {
            'x-component': 'Input',
          },
          fieldB: {
            'x-component': 'Input',
            'x-visible':
              '{{console.log("$record.fieldB") || $record.fieldA == "fieldA"}}',
          },

          fieldC: {
            'x-component': 'Input',
            'x-visible':
              '{{console.log("$record.fieldC") ||  $record.fieldB === "fieldB" }}',
          },
        },
      },
    },
  }

  const Container = observer((props) => {
    const field = useField<ObjectField>()
    useEffect(() => {
      // 不使用 batch：表现是正常的，A、B、C 均正确展示。
      batch(() => {
        // 特定的对象写法：表现也是正常。
        // Object.assign(field.value, {
        //   fieldA: 'fieldA',
        //   fieldB: 'fieldB',
        //   fieldC: 'fieldC',
        // })
        // 表现异常，只展示了 A、B
        Object.assign(field.value, {
          fieldB: 'fieldB',
          fieldC: 'fieldC',
          fieldA: 'fieldA',
        })
      })
    }, [])
    return (
      <ExpressionScope
        value={{
          get $record() {
            return field.value
          },
        }}
      >
        {props.children}
      </ExpressionScope>
    )
  })

  const SchemaField = createSchemaField({
    components: {
      Input: ({ value }) => {
        return <div>{value}</div>
      },
      Container,
    },
  })

  const App = observer(() => (
    <FormProvider form={form}>
      <SchemaField schema={schema} />
    </FormProvider>
  ))

  render(<App />)
  expect(form.mounted).toBeTruthy()
})
