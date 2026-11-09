
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "courses": {
                  Row: {
                    "id": string,"position": number,"status": Database["public"]['Enums']["course_status"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"position"?: number,"status"?: Database["public"]['Enums']["course_status"],"title": string
                  }
                  Update: {
                    "id"?: string,"position"?: number,"status"?: Database["public"]['Enums']["course_status"],"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"group_courses": {
                  Row: {
                    "course_id": string,"ended_at": string | null,"group_id": string,"id": string,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"ended_at"?: string | null,"group_id": string,"id"?: string,"started_at"?: string
                  }
                  Update: {
                    "course_id"?: string,"ended_at"?: string | null,"group_id"?: string,"id"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_courses_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_courses_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_memberships": {
                  Row: {
                    "group_id": string,"id": string,"joined_at": string,"left_at": string | null,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"student_id": string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"joined_at"?: string,"left_at"?: string | null,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_memberships_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_memberships_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "color": string,"description": string | null,"emblem_path": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"description"?: string | null,"emblem_path"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "color"?: string,"description"?: string | null,"emblem_path"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"privacy_group_overrides": {
                  Row: {
                    "group_id": string,"item": Database["public"]['Enums']["privacy_item"],"scope": Database["public"]['Enums']["privacy_scope"]
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"item": Database["public"]['Enums']["privacy_item"],"scope": Database["public"]['Enums']["privacy_scope"]
                  }
                  Update: {
                    "group_id"?: string,"item"?: Database["public"]['Enums']["privacy_item"],"scope"?: Database["public"]['Enums']["privacy_scope"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_group_overrides_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_settings": {
                  Row: {
                    "item": Database["public"]['Enums']["privacy_item"],"scope": Database["public"]['Enums']["privacy_scope"]
                  }
                  ComputedFields: never
                  Insert: {
                    "item": Database["public"]['Enums']["privacy_item"],"scope": Database["public"]['Enums']["privacy_scope"]
                  }
                  Update: {
                    "item"?: Database["public"]['Enums']["privacy_item"],"scope"?: Database["public"]['Enums']["privacy_scope"]
                  }
                  Relationships: [
                    
                  ]
                },"profile_name_changes": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"field": string,"id": string,"new_value": string | null,"old_value": string | null,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"field": string,"id"?: string,"new_value"?: string | null,"old_value"?: string | null,"profile_id": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"field"?: string,"id"?: string,"new_value"?: string | null,"old_value"?: string | null,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_name_changes_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_name_changes_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_config": NonNullable<Json>,"birth_date": string | null,"birth_date_locked": boolean,"full_name": string | null,"id": string,"last_seen_at": string | null,"login": string,"name_edit_locked": boolean,"nickname": string | null,"onboarding_done": boolean,"role": Database["public"]['Enums']["user_role"],"status": Database["public"]['Enums']["user_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_config"?: NonNullable<Json>,"birth_date"?: string | null,"birth_date_locked"?: boolean,"full_name"?: string | null,"id": string,"last_seen_at"?: string | null,"login": string,"name_edit_locked"?: boolean,"nickname"?: string | null,"onboarding_done"?: boolean,"role": Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["user_status"]
                  }
                  Update: {
                    "avatar_config"?: NonNullable<Json>,"birth_date"?: string | null,"birth_date_locked"?: boolean,"full_name"?: string | null,"id"?: string,"last_seen_at"?: string | null,"login"?: string,"name_edit_locked"?: boolean,"nickname"?: string | null,"onboarding_done"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["user_status"]
                  }
                  Relationships: [
                    
                  ]
                },"resource_groups": {
                  Row: {
                    "group_id": string,"resource_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"resource_id": string
                  }
                  Update: {
                    "group_id"?: string,"resource_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resource_groups_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resource_groups_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "resources"
      referencedColumns: ["id"]
    }
                  ]
                },"resource_views": {
                  Row: {
                    "first_viewed_at": string,"resource_id": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "first_viewed_at"?: string,"resource_id": string,"student_id": string
                  }
                  Update: {
                    "first_viewed_at"?: string,"resource_id"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resource_views_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "resources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "resource_views_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"resources": {
                  Row: {
                    "body_md": string | null,"created_at": string,"file_name": string | null,"file_size": number | null,"id": string,"position": number,"storage_path": string | null,"title": string,"topic_id": string,"type": Database["public"]['Enums']["resource_type"],"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md"?: string | null,"created_at"?: string,"file_name"?: string | null,"file_size"?: number | null,"id"?: string,"position"?: number,"storage_path"?: string | null,"title": string,"topic_id": string,"type": Database["public"]['Enums']["resource_type"],"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "body_md"?: string | null,"created_at"?: string,"file_name"?: string | null,"file_size"?: number | null,"id"?: string,"position"?: number,"storage_path"?: string | null,"title"?: string,"topic_id"?: string,"type"?: Database["public"]['Enums']["resource_type"],"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "resources_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"topics": {
                  Row: {
                    "course_id": string,"created_at": string,"id": string,"position": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"id"?: string,"position"?: number,"title": string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"id"?: string,"position"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "topics_course_id_fkey"
      columns: ["course_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "active_group_id":
{ Args: { "uid": string }; Returns: string
                           },
"can_access_course":
{ Args: { "cid": string,"uid": string }; Returns: boolean
                           },
"can_access_resource":
{ Args: { "rid": string,"uid": string }; Returns: boolean
                           },
"can_view":
{ Args: { "item": Database["public"]['Enums']["privacy_item"],"target": string,"viewer": string }; Returns: boolean
                           },
"is_teacher":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_visible_students":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_config": Json,"birthday_md": string,"full_name": string,"group_id": string,"id": string,"last_seen_at": string,"nickname": string,"same_group": boolean
            }[]
                           }
          }
          Enums: {
            "course_status": "active"|"finished","privacy_item": "avatar"|"online_status"|"stats"|"badges"|"birthday","privacy_scope": "everyone"|"own_group"|"nobody","resource_type": "link"|"file"|"note","user_role": "teacher"|"student","user_status": "active"|"archived"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "course_status": ["active", "finished"],"privacy_item": ["avatar", "online_status", "stats", "badges", "birthday"],"privacy_scope": ["everyone", "own_group", "nobody"],"resource_type": ["link", "file", "note"],"user_role": ["teacher", "student"],"user_status": ["active", "archived"]
          }
        }
} as const
