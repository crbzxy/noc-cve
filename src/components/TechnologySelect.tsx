import {
  Checkbox, FormControl, InputLabel, ListItemText, ListSubheader, MenuItem,
  OutlinedInput, Select, type SelectChangeEvent,
} from '@mui/material'
import { useMemo, type ReactNode } from 'react'
import type { TechnologyConfig } from '../config/sources.schema'
import { useSourcesConfig } from '../hooks/useSourcesConfig'
import { useFilters } from '../store/filters'

const ALL_TECH = '__all__'
const STACK_PREFIX = '__stack__:'
const TEL_GROUP = 'TEL'

const TEL_SUBGROUP_ORDER = [
  'Java / Spring',
  'Git / CI',
  'React',
  'Nginx',
  'Tomcat',
  'Apache HTTP',
  'WSO2',
]

const STACK_ORDER = [
  'Lenguajes y plataformas backend',
  'Frontend web',
  'Móvil',
  'Bases de datos',
  'Integración y mensajería',
  'ERP y plataformas',
  'Cloud e infraestructura',
  'CI/CD y herramientas',
  'Testing',
  'Servidores web y middleware',
]

type TechStack = {
  name: string
  techIds: string[]
  techs: TechnologyConfig[]
  subgroups?: Array<{ name: string; techs: TechnologyConfig[] }>
}

function stackToken(stackName: string): string {
  return `${STACK_PREFIX}${stackName}`
}

function isStackToken(value: string): boolean {
  return value.startsWith(STACK_PREFIX)
}

function parseStackToken(value: string): string {
  return value.slice(STACK_PREFIX.length)
}

function buildTelStack(technologies: TechnologyConfig[]): TechStack | null {
  const telTechs = technologies.filter((tech) => tech.group === TEL_GROUP)
  if (telTechs.length === 0) return null

  const bySubgroup = new Map<string, TechnologyConfig[]>()
  for (const tech of telTechs) {
    const name = tech.subgroup?.trim() || 'General'
    const bucket = bySubgroup.get(name)
    if (bucket) bucket.push(tech)
    else bySubgroup.set(name, [tech])
  }

  const subgroups = [
    ...TEL_SUBGROUP_ORDER.filter((name) => bySubgroup.has(name)),
    ...[...bySubgroup.keys()].filter((name) => !TEL_SUBGROUP_ORDER.includes(name)),
  ].map((name) => ({ name, techs: bySubgroup.get(name) ?? [] }))

  return {
    name: TEL_GROUP,
    techs: telTechs,
    techIds: telTechs.map((tech) => tech.id),
    subgroups,
  }
}

function buildOtherStacks(technologies: TechnologyConfig[]): TechStack[] {
  const others = technologies.filter((tech) => tech.group !== TEL_GROUP)
  const byStack = new Map<string, TechnologyConfig[]>()
  for (const tech of others) {
    const stackName = tech.subgroup?.trim() || 'General'
    const bucket = byStack.get(stackName)
    if (bucket) bucket.push(tech)
    else byStack.set(stackName, [tech])
  }

  const ordered = STACK_ORDER
    .filter((name) => byStack.has(name))
    .map((name) => {
      const techs = byStack.get(name) ?? []
      return { name, techs, techIds: techs.map((tech) => tech.id) }
    })

  for (const [name, techs] of byStack) {
    if (STACK_ORDER.includes(name)) continue
    ordered.push({ name, techs, techIds: techs.map((tech) => tech.id) })
  }
  return ordered
}

function sameIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((id) => rightSet.has(id))
}

export function TechnologySelect({ minWidth = 280 }: { minWidth?: number }) {
  const f = useFilters()
  const { config } = useSourcesConfig()
  const techOptions = config.technologies
  const techIds = useMemo(() => techOptions.map((tech) => tech.id), [techOptions])
  const telStack = useMemo(() => buildTelStack(techOptions), [techOptions])
  const otherStacks = useMemo(() => buildOtherStacks(techOptions), [techOptions])
  const stacks = useMemo(
    () => (telStack ? [telStack, ...otherStacks] : otherStacks),
    [telStack, otherStacks],
  )
  const allSelected = f.techAll
  const selectedTech = f.technologies.filter((id) => techIds.includes(id))
  const selectValue = allSelected ? [ALL_TECH] : selectedTech

  const techLabelById = useMemo(
    () => Object.fromEntries(techOptions.map((tech) => [tech.id, tech.label])),
    [techOptions],
  )

  if (techOptions.length === 0) return null

  const applyStackSelection = (stackName: string) => {
    const stack = stacks.find((item) => item.name === stackName)
    const stackIds = stack?.techIds ?? []
    const alreadyOnlyThisStack = !allSelected && sameIdSet(selectedTech, stackIds)
    // Una sola escritura: nunca dejar techAll=true al elegir TEL/stack
    if (alreadyOnlyThisStack) {
      f.setTechnologies([])
      return
    }
    f.setTechnologies(stackIds)
  }

  const onTechChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value
    const next = typeof value === 'string' ? value.split(',') : value
    const previous = selectValue
    const added = next.filter((id) => !previous.includes(id))

    // 1) Clic en TEL u otro stack → solo esas tecnologías
    const addedStack = added.find(isStackToken)
    if (addedStack) {
      applyStackSelection(parseStackToken(addedStack))
      return
    }

    // Si el token de stack sigue en next (MUI a veces no lo reporta como "added")
    const anyStack = next.find(isStackToken)
    if (anyStack && !next.includes(ALL_TECH)) {
      applyStackSelection(parseStackToken(anyStack))
      return
    }

    // 2) Clic en Todas
    if (added.includes(ALL_TECH) || (next.includes(ALL_TECH) && !allSelected)) {
      f.setTechAll(true)
      return
    }

    // 3) Tecnologías sueltas (nunca mezclar con Todas)
    f.setTechnologies(next.filter((id) => id !== ALL_TECH && !isStackToken(id) && techIds.includes(id)))
  }

  const renderTechValue = (selected: string[]) => {
    if (allSelected || selected.includes(ALL_TECH)) return 'Todas'
    if (selected.length === 0) return 'Ninguna'
    for (const stack of stacks) {
      if (sameIdSet(selected, stack.techIds)) return stack.name
    }
    if (selected.length <= 2) {
      return selected.map((id) => techLabelById[id] ?? id).join(', ')
    }
    return `${selected.length} tecnologías`
  }

  const isStackFullySelected = (stack: TechStack) =>
    !allSelected && sameIdSet(selectedTech, stack.techIds)

  const isStackPartiallySelected = (stack: TechStack) =>
    !allSelected
    && stack.techIds.some((id) => selectedTech.includes(id))
    && !isStackFullySelected(stack)

  const renderStackItems = (stack: TechStack): ReactNode[] => {
    const items: ReactNode[] = [
      <MenuItem key={`stack-${stack.name}`} value={stackToken(stack.name)} dense>
        <Checkbox
          size="small"
          checked={isStackFullySelected(stack)}
          indeterminate={isStackPartiallySelected(stack)}
        />
        <ListItemText
          primary={stack.name}
          secondary={stack.name === TEL_GROUP
            ? `Solo stack TEL (${stack.techIds.length})`
            : `${stack.techIds.length} tecnologías`}
          slotProps={{ primary: { sx: { fontWeight: 700 } } }}
        />
      </MenuItem>,
    ]

    if (stack.subgroups) {
      for (const subgroup of stack.subgroups) {
        items.push(
          <ListSubheader
            key={`sub-${stack.name}-${subgroup.name}`}
            sx={{ bgcolor: 'background.paper', lineHeight: '28px', pl: 4 }}
          >
            {subgroup.name}
          </ListSubheader>,
        )
        for (const tech of subgroup.techs) {
          items.push(
            <MenuItem key={tech.id} value={tech.id} dense sx={{ pl: 5 }}>
              <Checkbox size="small" checked={!allSelected && selectedTech.includes(tech.id)} />
              <ListItemText primary={tech.label} />
            </MenuItem>,
          )
        }
      }
      return items
    }

    for (const tech of stack.techs) {
      items.push(
        <MenuItem key={tech.id} value={tech.id} dense sx={{ pl: 4 }}>
          <Checkbox size="small" checked={!allSelected && selectedTech.includes(tech.id)} />
          <ListItemText primary={tech.label} />
        </MenuItem>,
      )
    }
    return items
  }

  return (
    <FormControl size="small" sx={{ minWidth }}>
      <InputLabel id="tech-multiselect-label">Tecnologías</InputLabel>
      <Select
        labelId="tech-multiselect-label"
        multiple
        value={selectValue}
        onChange={onTechChange}
        input={<OutlinedInput label="Tecnologías" />}
        renderValue={renderTechValue}
        MenuProps={{ slotProps: { paper: { sx: { maxHeight: 440 } } } }}
      >
        <MenuItem value={ALL_TECH} dense>
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={!allSelected && selectedTech.length > 0}
          />
          <ListItemText
            primary="Todas"
            secondary={allSelected ? 'Sin filtro por tecnología' : 'Todo el catálogo'}
          />
        </MenuItem>
        {stacks.flatMap((stack) => renderStackItems(stack))}
      </Select>
    </FormControl>
  )
}
