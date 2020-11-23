import { isArr, isBool, isFn, isStr } from '@formily/shared'
import {
  ValidatorDescription,
  ValidatorFunction,
  ValidatorParsedFunction,
  Validator,
  ValidatorRules,
  isValidateResult,
  IValidatorOptions
} from './types'
import { getValidateRules, getValidateLocale } from './registry'
import { render } from './template'

const intersection = (arr1: string[], arr2: string[]) => {
  return arr1.filter(key => arr2.includes(key))
}

const getRuleMessage = (rule: ValidatorRules, type: string) => {
  const registryRuleKeys = Object.keys(getValidateRules() || {})
  const currentRuleKeys = Object.keys(rule || {})
  if (
    isFn(rule.validator) ||
    intersection(currentRuleKeys, registryRuleKeys).length > 2
  ) {
    if (rule.format) {
      return rule.message || getValidateLocale(type)
    }
    return getValidateLocale(type)
  } else {
    return rule.message || getValidateLocale(type)
  }
}

export const parseDescription = (
  description: ValidatorDescription
): ValidatorRules => {
  const rules: ValidatorRules = {}
  if (isStr(description)) {
    rules.format = description
  }
  if (isFn(description)) {
    rules.validator = description
  }
  Object.assign(rules, description)
  rules.triggerType = rules.triggerType || 'onInput'
  return rules
}

export const parseDescriptions = <Context = any>(
  validator: Validator<Context>
): ValidatorRules[] => {
  const array = isArr(validator) ? validator : [validator]
  return array.map(description => {
    return parseDescription(description)
  })
}

export const parseRules = (
  rules: ValidatorRules
): ValidatorParsedFunction[] => {
  const rulesKeys = Object.keys(rules || {}).sort(key =>
    key === 'validator' ? 1 : -1
  )
  const createValidate = (
    callback: ValidatorFunction,
    message: string
  ) => async (value: any, context: any) => {
    const results = await callback(
      value,
      {
        ...rules,
        message
      },
      {
        ...rules,
        ...context
      }
    )
    if (isBool(results)) {
      if (!results) {
        return render(
          {
            type: 'error',
            message
          },
          {
            ...rules,
            ...context
          }
        )
      }
      return
    } else if (results) {
      if (isValidateResult(results)) {
        return render(results, context)
      }
      return render(
        {
          type: 'error',
          message: results
        },
        {
          ...rules,
          ...context
        }
      )
    }
  }

  return rulesKeys.reduce((buf, key) => {
    const callback = getValidateRules(key)
    return callback
      ? buf.concat(createValidate(callback, getRuleMessage(rules, key)))
      : buf
  }, [])
}

export const parseValidator = <Context = any>(
  validator: Validator<Context>,
  options?: IValidatorOptions
): ValidatorParsedFunction<Context>[] => {
  const array = isArr(validator) ? validator : [validator]
  return array.reduce((buf, description) => {
    const rules = parseDescription(description)
    if (options.triggerType && options.triggerType !== rules.triggerType)
      return buf
    return rules ? buf.concat(parseRules(rules)) : buf
  }, [])
}