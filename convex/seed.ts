import { internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import {
  AccessLevel,
  Department,
  EmployeeStatus,
  Level,
  ResourceType,
  Role
} from './helpers/validators'

export const seed = internalMutation({
  args: {},

  handler: async (ctx) => {
    const employees = [
      // --- EXISTENTES ---
      {
        name: 'María López',
        email: 'maria@opspilot.dev',
        role: Role.Developer,
        level: Level.Senior,
        department: Department.Engineering,
        status: EmployeeStatus.Active
      },
      {
        name: 'Carlos Díaz',
        email: 'carlos@opspilot.dev',
        role: Role.Support,
        level: Level.Mid,
        department: Department.Support,
        status: EmployeeStatus.Active
      },
      {
        name: 'Laura Pérez',
        email: 'laura@opspilot.dev',
        role: Role.Devops,
        level: Level.Lead,
        department: Department.Engineering,
        status: EmployeeStatus.Active
      },
      {
        name: 'Pedro García',
        email: 'pedro@opspilot.dev',
        role: Role.Developer,
        level: Level.Junior,
        department: Department.Engineering,
        status: EmployeeStatus.Active
      },

      // --- NUEVOS USUARIOS (Roles y Niveles restantes) ---
      {
        name: 'Ana Martínez',
        email: 'ana@opspilot.dev',
        role: Role.QA,
        level: Level.Mid,
        department: Department.Engineering,
        status: EmployeeStatus.Active
      },
      {
        name: 'David Ruiz',
        email: 'david@opspilot.dev',
        role: Role.Designer,
        level: Level.Senior,
        department: Department.Design,
        status: EmployeeStatus.Active
      },
      {
        name: 'Elena Torres',
        email: 'elena@opspilot.dev',
        role: Role.ProductManager,
        level: Level.Lead,
        department: Department.Product,
        status: EmployeeStatus.Active
      },
      {
        name: 'Lucas Morales',
        email: 'lucas@opspilot.dev',
        role: Role.Developer,
        level: Level.Junior,
        department: Department.Engineering,
        status: EmployeeStatus.Active
      },
      {
        name: 'Sofía Navarro',
        email: 'sofia@opspilot.dev',
        role: Role.Devops,
        level: Level.Senior,
        department: Department.Operations,
        status: EmployeeStatus.Active
      }
    ]

    const resources = [
      {
        name: 'GitHub',
        slug: 'github',
        type: ResourceType.Application,
        sensitive: false
      },
      {
        name: 'Jira',
        slug: 'jira',
        type: ResourceType.Application,
        sensitive: false
      },
      {
        name: 'VPN',
        slug: 'vpn',
        type: ResourceType.Infrastructure,
        sensitive: false
      },
      {
        name: 'Staging',
        slug: 'staging',
        type: ResourceType.Environment,
        sensitive: false
      },
      {
        name: 'Production',
        slug: 'production',
        type: ResourceType.Environment,
        sensitive: true
      }
    ]

    const employeeIds = new Map<string, Id<'employees'>>()
    const resourceIds = new Map<string, Id<'resources'>>()

    // Insertar / obtener Empleados
    for (const employee of employees) {
      const existing = await ctx.db
        .query('employees')
        .withIndex('by_email', q =>
          q.eq('email', employee.email)
        )
        .unique()

      const id
        = existing?._id
          ?? (await ctx.db.insert('employees', employee))

      employeeIds.set(employee.email, id)
    }

    // Insertar / obtener Recursos
    for (const resource of resources) {
      const existing = await ctx.db
        .query('resources')
        .withIndex('by_slug', q =>
          q.eq('slug', resource.slug)
        )
        .unique()

      const id
        = existing?._id
          ?? (await ctx.db.insert('resources', resource))

      resourceIds.set(resource.slug, id)
    }

    const initialPermissions = [
      // Permisos existentes
      { email: 'maria@opspilot.dev', resource: 'github', accessLevel: AccessLevel.Write },
      { email: 'maria@opspilot.dev', resource: 'jira', accessLevel: AccessLevel.Write },
      { email: 'carlos@opspilot.dev', resource: 'jira', accessLevel: AccessLevel.Write },
      { email: 'carlos@opspilot.dev', resource: 'vpn', accessLevel: AccessLevel.Read },
      { email: 'laura@opspilot.dev', resource: 'github', accessLevel: AccessLevel.Admin },
      { email: 'laura@opspilot.dev', resource: 'vpn', accessLevel: AccessLevel.Admin },
      { email: 'laura@opspilot.dev', resource: 'production', accessLevel: AccessLevel.Admin },
      { email: 'pedro@opspilot.dev', resource: 'github', accessLevel: AccessLevel.Write },
      { email: 'pedro@opspilot.dev', resource: 'staging', accessLevel: AccessLevel.Write },

      // Permisos para los nuevos roles
      { email: 'ana@opspilot.dev', resource: 'jira', accessLevel: AccessLevel.Write }, // QA
      { email: 'ana@opspilot.dev', resource: 'staging', accessLevel: AccessLevel.Write }, // QA
      { email: 'david@opspilot.dev', resource: 'jira', accessLevel: AccessLevel.Read }, // Designer
      { email: 'elena@opspilot.dev', resource: 'jira', accessLevel: AccessLevel.Admin }, // PM
      { email: 'elena@opspilot.dev', resource: 'github', accessLevel: AccessLevel.Read }, // PM
      { email: 'lucas@opspilot.dev', resource: 'github', accessLevel: AccessLevel.Read }, // Junior
      { email: 'sofia@opspilot.dev', resource: 'vpn', accessLevel: AccessLevel.Admin }, // Ops
      { email: 'sofia@opspilot.dev', resource: 'production', accessLevel: AccessLevel.Write } // Ops
    ]

    // Insertar Permisos (evitando duplicados)
    for (const permission of initialPermissions) {
      const employeeId = employeeIds.get(permission.email)
      const resourceId = resourceIds.get(permission.resource)

      if (!employeeId || !resourceId) {
        continue
      }

      const existing = await ctx.db
        .query('permissions')
        .withIndex('by_employee_resource', q =>
          q
            .eq('employeeId', employeeId)
            .eq('resourceId', resourceId)
        )
        .unique()

      if (!existing) {
        await ctx.db.insert('permissions', {
          employeeId,
          resourceId,
          accessLevel: permission.accessLevel,
          grantedAt: Date.now()
        })
      }
    }

    return {
      employees: employeeIds.size,
      resources: resourceIds.size,
      permissions: initialPermissions.length
    }
  }
})
