export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          detail: Json
          id: number
          target: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          detail?: Json
          id?: never
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_calls: {
        Row: {
          cost_micros: number
          created_at: string
          feature: string
          id: number
          input_tokens: number
          list_cost_micros: number
          model: string
          ok: boolean
          output_tokens: number
          prompt_version: number | null
          provider: string
          thinking_tokens: number
          tool_rounds: number
          user_id: string | null
        }
        Insert: {
          cost_micros: number
          created_at?: string
          feature: string
          id?: never
          input_tokens: number
          list_cost_micros?: number
          model: string
          ok?: boolean
          output_tokens: number
          prompt_version?: number | null
          provider: string
          thinking_tokens?: number
          tool_rounds?: number
          user_id?: string | null
        }
        Update: {
          cost_micros?: number
          created_at?: string
          feature?: string
          id?: never
          input_tokens?: number
          list_cost_micros?: number
          model?: string
          ok?: boolean
          output_tokens?: number
          prompt_version?: number | null
          provider?: string
          thinking_tokens?: number
          tool_rounds?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          correct: boolean
          created_at: string
          duration_ms: number | null
          error_tag: string | null
          id: string
          item_id: string
          response: Json
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          duration_ms?: number | null
          error_tag?: string | null
          id: string
          item_id: string
          response: Json
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          duration_ms?: number | null
          error_tag?: string | null
          id?: string
          item_id?: string
          response?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_error_tag_fkey"
            columns: ["error_tag"]
            isOneToOne: false
            referencedRelation: "micro_skills"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "attempts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          concept_id: string | null
          content: string
          course_id: string | null
          created_at: string
          embedding: string | null
          id: number
          owner_id: string
          page: number | null
          source_id: string
          tsv: unknown
          visibility: Database["public"]["Enums"]["source_visibility"]
        }
        Insert: {
          concept_id?: string | null
          content: string
          course_id?: string | null
          created_at?: string
          embedding?: string | null
          id?: never
          owner_id: string
          page?: number | null
          source_id: string
          tsv?: unknown
          visibility: Database["public"]["Enums"]["source_visibility"]
        }
        Update: {
          concept_id?: string | null
          content?: string
          course_id?: string | null
          created_at?: string
          embedding?: string | null
          id?: never
          owner_id?: string
          page?: number | null
          source_id?: string
          tsv?: unknown
          visibility?: Database["public"]["Enums"]["source_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "chunks_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_follows: {
        Row: {
          concept_id: string
          course_id: string | null
          created_at: string
          user_id: string
        }
        Insert: {
          concept_id: string
          course_id?: string | null
          created_at?: string
          user_id: string
        }
        Update: {
          concept_id?: string
          course_id?: string | null
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_follows_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_follows_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_prereqs: {
        Row: {
          concept_id: string
          prereq_concept_id: string
        }
        Insert: {
          concept_id: string
          prereq_concept_id: string
        }
        Update: {
          concept_id?: string
          prereq_concept_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_prereqs_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_prereqs_prereq_concept_id_fkey"
            columns: ["prereq_concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          created_at: string
          created_by: string | null
          current_lesson_id: string | null
          description: string | null
          embedding: string | null
          id: string
          level_band: Database["public"]["Enums"]["level_band"]
          listed: boolean
          merged_into: string | null
          micro_skills: string[]
          prerequisite_hints: string[]
          slug: string
          status: string
          subject: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_lesson_id?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          level_band: Database["public"]["Enums"]["level_band"]
          listed?: boolean
          merged_into?: string | null
          micro_skills?: string[]
          prerequisite_hints?: string[]
          slug: string
          status?: string
          subject: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_lesson_id?: string | null
          description?: string | null
          embedding?: string | null
          id?: string
          level_band?: Database["public"]["Enums"]["level_band"]
          listed?: boolean
          merged_into?: string | null
          micro_skills?: string[]
          prerequisite_hints?: string[]
          slug?: string
          status?: string
          subject?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "concepts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_current_lesson_fk"
            columns: ["current_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concepts_subject_fkey"
            columns: ["subject"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["code"]
          },
        ]
      }
      consents: {
        Row: {
          granted_at: string
          id: number
          kind: string
          revoked_at: string | null
          user_id: string
          version: string
        }
        Insert: {
          granted_at?: string
          id?: never
          kind: string
          revoked_at?: string | null
          user_id: string
          version: string
        }
        Update: {
          granted_at?: string
          id?: never
          kind?: string
          revoked_at?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_terms: {
        Row: {
          course_id: string
          current_week_override: number | null
          exam_date: string | null
          id: string
          semester: number
          session: string
          starts_on: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          current_week_override?: number | null
          exam_date?: string | null
          id?: string
          semester: number
          session: string
          starts_on: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          current_week_override?: number | null
          exam_date?: string | null
          id?: string
          semester?: number
          session?: string
          starts_on?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_terms_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_terms_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_terms_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          code_norm: string | null
          created_at: string
          created_by: string | null
          id: string
          level: number | null
          outline_locked: boolean
          semester: number | null
          status: Database["public"]["Enums"]["course_status"]
          subject: string | null
          title: string
          university_id: string
        }
        Insert: {
          code: string
          code_norm?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          level?: number | null
          outline_locked?: boolean
          semester?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          subject?: string | null
          title: string
          university_id: string
        }
        Update: {
          code?: string
          code_norm?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          level?: number | null
          outline_locked?: boolean
          semester?: number | null
          status?: Database["public"]["Enums"]["course_status"]
          subject?: string | null
          title?: string
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_subject_fkey"
            columns: ["subject"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      curators: {
        Row: {
          approved_by: string | null
          created_at: string
          subject: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          subject: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curators_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curators_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curators_subject_fkey"
            columns: ["subject"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "curators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_activity: {
        Row: {
          day: string
          events: number
          last_event_at: string | null
          sessions: number
          user_id: string
        }
        Insert: {
          day: string
          events?: number
          last_event_at?: string | null
          sessions?: number
          user_id: string
        }
        Update: {
          day?: string
          events?: number
          last_event_at?: string | null
          sessions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage: {
        Row: {
          count: number
          day: string
          feature: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          feature: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          feature?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          role: string
          user_id: string
          verified: boolean
        }
        Insert: {
          course_id: string
          created_at?: string
          role?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          course_id?: string
          created_at?: string
          role?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          concept_confidence: number | null
          concept_id: string | null
          course_id: string
          created_at: string
          id: string
          item_id: string | null
          marks: number | null
          number: string | null
          qtype: string | null
          source_id: string
          text_latex: string
          year: number | null
        }
        Insert: {
          concept_confidence?: number | null
          concept_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          marks?: number | null
          number?: string | null
          qtype?: string | null
          source_id: string
          text_latex: string
          year?: number | null
        }
        Update: {
          concept_confidence?: number | null
          concept_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          marks?: number | null
          number?: string | null
          qtype?: string | null
          source_id?: string
          text_latex?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          active: boolean
          concept_id: string | null
          course_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          lab_slug: string | null
          target_date: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          concept_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["goal_kind"]
          lab_slug?: string | null
          target_date?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          concept_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          lab_slug?: string | null
          target_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          answer: Json
          block_id: string | null
          concept_id: string
          contributor_id: string | null
          course_id: string | null
          created_at: string
          difficulty: number
          explanation: string | null
          id: string
          lesson_id: string | null
          micro_skills: string[]
          origin: string
          owner_id: string | null
          source_id: string | null
          status: Database["public"]["Enums"]["lesson_status"]
          stem: Json
          type: Database["public"]["Enums"]["item_type"]
          verification: Json
        }
        Insert: {
          answer: Json
          block_id?: string | null
          concept_id: string
          contributor_id?: string | null
          course_id?: string | null
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          micro_skills?: string[]
          origin: string
          owner_id?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lesson_status"]
          stem: Json
          type: Database["public"]["Enums"]["item_type"]
          verification: Json
        }
        Update: {
          answer?: Json
          block_id?: string | null
          concept_id?: string
          contributor_id?: string | null
          course_id?: string | null
          created_at?: string
          difficulty?: number
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          micro_skills?: string[]
          origin?: string
          owner_id?: string | null
          source_id?: string | null
          status?: Database["public"]["Enums"]["lesson_status"]
          stem?: Json
          type?: Database["public"]["Enums"]["item_type"]
          verification?: Json
        }
        Relationships: [
          {
            foreignKeyName: "items_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          owner_id: string | null
          payload: Json
          queue: string
          result: Json | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          owner_id?: string | null
          payload: Json
          queue: string
          result?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          owner_id?: string | null
          payload?: Json
          queue?: string
          result?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_runs: {
        Row: {
          created_at: string
          data: Json
          id: string
          lab_slug: string
          result: Json | null
          score: number | null
          seed: number
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          lab_slug: string
          result?: Json | null
          score?: number | null
          seed: number
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          lab_slug?: string
          result?: Json | null
          score?: number | null
          seed?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_flags: {
        Row: {
          block_id: string
          created_at: string
          id: number
          lesson_id: string
          note: string | null
          reason: string
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          block_id: string
          created_at?: string
          id?: never
          lesson_id: string
          note?: string | null
          reason: string
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          block_id?: string
          created_at?: string
          id?: never
          lesson_id?: string
          note?: string | null
          reason?: string
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_flags_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          lesson_id: string
          step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          lesson_id: string
          step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          lesson_id?: string
          step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          completions: number
          concept_id: string
          course_id: string | null
          created_at: string
          dsl_version: number
          hidden_blocks: string[]
          id: string
          kind: string
          model: string | null
          owner_id: string | null
          published_at: string | null
          requested_by: string | null
          source_refs: number[]
          sources_used: number
          spec: Json
          status: Database["public"]["Enums"]["lesson_status"]
          trust: string
          verified_by: string | null
          version: number
        }
        Insert: {
          completions?: number
          concept_id: string
          course_id?: string | null
          created_at?: string
          dsl_version: number
          hidden_blocks?: string[]
          id?: string
          kind?: string
          model?: string | null
          owner_id?: string | null
          published_at?: string | null
          requested_by?: string | null
          source_refs?: number[]
          sources_used?: number
          spec: Json
          status?: Database["public"]["Enums"]["lesson_status"]
          trust?: string
          verified_by?: string | null
          version?: number
        }
        Update: {
          completions?: number
          concept_id?: string
          course_id?: string | null
          created_at?: string
          dsl_version?: number
          hidden_blocks?: string[]
          id?: string
          kind?: string
          model?: string | null
          owner_id?: string | null
          published_at?: string | null
          requested_by?: string | null
          source_refs?: number[]
          sources_used?: number
          spec?: Json
          status?: Database["public"]["Enums"]["lesson_status"]
          trust?: string
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "lessons_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery: {
        Row: {
          attempts_count: number
          concept_id: string
          level: string
          m: number
          proficient_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number
          concept_id: string
          level?: string
          m?: number
          proficient_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number
          concept_id?: string
          level?: string
          m?: number
          proficient_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_skills: {
        Row: {
          code: string
          description: string | null
          subject: string
          title: string
        }
        Insert: {
          code: string
          description?: string | null
          subject: string
          title: string
        }
        Update: {
          code?: string
          description?: string | null
          subject?: string
          title?: string
        }
        Relationships: []
      }
      outline_revisions: {
        Row: {
          course_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          editor_id: string | null
          id: number
          outline: Json
          source: string
          status: string
        }
        Insert: {
          course_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          editor_id?: string | null
          id?: never
          outline: Json
          source: string
          status?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          editor_id?: string | null
          id?: never
          outline?: Json
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outline_revisions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outline_revisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outline_revisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outline_revisions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outline_revisions_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_events: {
        Row: {
          created_at: string
          detail: Json
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: never
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          est_minutes: number
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          plan_date: string
          position: number
          priority: number
          reason: string
          ref: Json
          status: Database["public"]["Enums"]["task_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          est_minutes: number
          id?: string
          kind: Database["public"]["Enums"]["task_kind"]
          plan_date: string
          position: number
          priority: number
          reason: string
          ref: Json
          status?: Database["public"]["Enums"]["task_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          est_minutes?: number
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          plan_date?: string
          position?: number
          priority?: number
          reason?: string
          ref?: Json
          status?: Database["public"]["Enums"]["task_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_month: number | null
          birth_year: number | null
          created_at: string
          daily_minutes: number
          data_saver: boolean
          department: string | null
          display_name: string
          id: string
          is_adult: boolean
          level: number | null
          locale: string
          onboarded_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          university_id: string | null
          updated_at: string
        }
        Insert: {
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          daily_minutes?: number
          data_saver?: boolean
          department?: string | null
          display_name?: string
          id: string
          is_adult?: boolean
          level?: number | null
          locale?: string
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          daily_minutes?: number
          data_saver?: boolean
          department?: string | null
          display_name?: string
          id?: string
          is_adult?: boolean
          level?: number | null
          locale?: string
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: number
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          id?: never
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_kind: string
        }
        Update: {
          created_at?: string
          id?: never
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cards: {
        Row: {
          difficulty: number
          due: string
          elapsed_days: number
          item_id: string
          lapses: number
          last_review: string | null
          reps: number
          scheduled_days: number
          stability: number
          state: number
          user_id: string
        }
        Insert: {
          difficulty: number
          due: string
          elapsed_days?: number
          item_id: string
          lapses?: number
          last_review?: string | null
          reps?: number
          scheduled_days?: number
          stability: number
          state?: number
          user_id: string
        }
        Update: {
          difficulty?: number
          due?: string
          elapsed_days?: number
          item_id?: string
          lapses?: number
          last_review?: string | null
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_cards_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_events: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          received_at: string
          screen_id: string
          user_id: string
        }
        Insert: {
          completed_at: string
          id: string
          lesson_id: string
          received_at?: string
          screen_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          received_at?: string
          screen_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          is_lecturer_source: boolean
          kind: Database["public"]["Enums"]["source_kind"]
          license_attested_at: string | null
          owner_id: string
          page_count: number | null
          review: Database["public"]["Enums"]["review_status"]
          review_reason: string | null
          sha256: string | null
          storage_path: string | null
          title: string
          visibility: Database["public"]["Enums"]["source_visibility"]
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_lecturer_source?: boolean
          kind: Database["public"]["Enums"]["source_kind"]
          license_attested_at?: string | null
          owner_id: string
          page_count?: number | null
          review?: Database["public"]["Enums"]["review_status"]
          review_reason?: string | null
          sha256?: string | null
          storage_path?: string | null
          title: string
          visibility?: Database["public"]["Enums"]["source_visibility"]
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          is_lecturer_source?: boolean
          kind?: Database["public"]["Enums"]["source_kind"]
          license_attested_at?: string | null
          owner_id?: string
          page_count?: number | null
          review?: Database["public"]["Enums"]["review_status"]
          review_reason?: string | null
          sha256?: string | null
          storage_path?: string | null
          title?: string
          visibility?: Database["public"]["Enums"]["source_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "sources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          sensitive: boolean
          title: string
        }
        Insert: {
          code: string
          sensitive?: boolean
          title: string
        }
        Update: {
          code?: string
          sensitive?: boolean
          title?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          confirmed_transcription: Json | null
          created_at: string
          id: string
          image_path: string
          item_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          transcription: Json | null
          user_id: string
          verdict: Json | null
        }
        Insert: {
          confirmed_transcription?: Json | null
          created_at?: string
          id?: string
          image_path: string
          item_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          transcription?: Json | null
          user_id: string
          verdict?: Json | null
        }
        Update: {
          confirmed_transcription?: Json | null
          created_at?: string
          id?: string
          image_path?: string
          item_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          transcription?: Json | null
          user_id?: string
          verdict?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          ends: string
          id: string
          owner_id: string | null
          starts: string
          venue: string | null
          week_range: unknown
          weekday: number
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          ends: string
          id?: string
          owner_id?: string | null
          starts: string
          venue?: string | null
          week_range?: unknown
          weekday: number
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          ends?: string
          id?: string
          owner_id?: string | null
          starts?: string
          venue?: string | null
          week_range?: unknown
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          archived_at: string | null
          concept_id: string
          course_id: string
          created_at: string
          description: string | null
          id: string
          position: number
          title: string
          week: number | null
        }
        Insert: {
          archived_at?: string | null
          concept_id: string
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          position: number
          title: string
          week?: number | null
        }
        Update: {
          archived_at?: string | null
          concept_id?: string
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_messages: {
        Row: {
          content: Json
          created_at: string
          grounded: boolean | null
          id: number
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          grounded?: boolean | null
          id?: never
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          grounded?: boolean | null
          id?: never
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "tutor_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_threads: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_threads_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          short_name: string
          staff_email_domain: string | null
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          name: string
          short_name: string
          staff_email_domain?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          short_name?: string
          staff_email_domain?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          consent_version: string
          created_at: string
          email: string
          reason: string
        }
        Insert: {
          consent_version: string
          created_at?: string
          email: string
          reason: string
        }
        Update: {
          consent_version?: string
          created_at?: string
          email?: string
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          display_name: string | null
          id: string | null
        }
        Insert: {
          display_name?: string | null
          id?: string | null
        }
        Update: {
          display_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_spend_micros: {
        Args: { p_features?: string[]; p_since: string; p_user?: string }
        Returns: number
      }
      apply_outline: {
        Args: { p_course: string; p_topics: Json }
        Returns: undefined
      }
      consume_quota: {
        Args: { p_feature: string; p_limit: number; p_user: string }
        Returns: boolean
      }
      create_concept: {
        Args: {
          p_created_by: string
          p_description: string
          p_embedding: string
          p_level_band: Database["public"]["Enums"]["level_band"]
          p_micro_skills: string[]
          p_prerequisite_hints: string[]
          p_slug: string
          p_subject: string
          p_title: string
        }
        Returns: string
      }
      enqueue_job: {
        Args: {
          p_dedupe?: string
          p_owner?: string
          p_payload: Json
          p_queue: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_adult_active: { Args: never; Returns: boolean }
      is_course_lecturer: { Args: { p_course: string }; Returns: boolean }
      is_curator: { Args: { p_concept: string }; Returns: boolean }
      is_member: { Args: { p_course: string }; Returns: boolean }
      match_chunks: {
        Args: {
          p_concept: string
          p_course: string
          p_embedding: string
          p_limit?: number
          p_query: string
          p_user: string
        }
        Returns: {
          content: string
          id: number
          page: number
          score: number
          source_id: string
        }[]
      }
      match_concepts: {
        Args: {
          p_embedding: string
          p_level_band: Database["public"]["Enums"]["level_band"]
          p_limit?: number
          p_subject: string
        }
        Returns: {
          description: string
          id: string
          similarity: number
          slug: string
          subject: string
          title: string
        }[]
      }
      merge_concepts: {
        Args: { p_admin: string; p_loser: string; p_survivor: string }
        Returns: undefined
      }
      refund_quota: {
        Args: { p_feature: string; p_user: string }
        Returns: undefined
      }
      search_courses: {
        Args: { p_limit?: number; p_query: string; p_university: string }
        Returns: {
          code: string
          id: string
          level: number
          members: number
          score: number
          subject: string
          title: string
        }[]
      }
      shared_lesson_sources: {
        Args: { p_concept: string; p_limit?: number }
        Returns: {
          content: string
          id: number
          page: number
          source_id: string
        }[]
      }
    }
    Enums: {
      account_status: "active" | "lecturer_pending" | "suspended" | "deleted"
      course_status: "active" | "pending" | "archived"
      goal_kind:
        | "understand_topic"
        | "practical_ready"
        | "master_course"
        | "exam"
      item_type:
        | "mcq"
        | "numeric"
        | "expression"
        | "short_text"
        | "order"
        | "match"
      job_status: "queued" | "running" | "done" | "failed"
      lesson_status: "draft" | "review" | "published" | "superseded" | "hidden"
      level_band: "foundation" | "introductory" | "intermediate" | "advanced"
      review_status:
        | "pending"
        | "approved"
        | "needs_review"
        | "rejected"
        | "withdrawn"
      source_kind:
        | "textbook_private"
        | "notes"
        | "past_paper"
        | "lab_manual"
        | "handout"
        | "solution"
        | "scheme"
      source_visibility: "private" | "course" | "bank"
      submission_status:
        | "transcribing"
        | "needs_confirmation"
        | "marking"
        | "done"
        | "failed"
      task_kind:
        | "lesson"
        | "review"
        | "practice"
        | "lab"
        | "preview"
        | "recap"
        | "remediation"
        | "mock"
        | "teach_back"
      task_status: "planned" | "done" | "skipped" | "rolled"
      user_role: "student" | "lecturer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "lecturer_pending", "suspended", "deleted"],
      course_status: ["active", "pending", "archived"],
      goal_kind: [
        "understand_topic",
        "practical_ready",
        "master_course",
        "exam",
      ],
      item_type: [
        "mcq",
        "numeric",
        "expression",
        "short_text",
        "order",
        "match",
      ],
      job_status: ["queued", "running", "done", "failed"],
      lesson_status: ["draft", "review", "published", "superseded", "hidden"],
      level_band: ["foundation", "introductory", "intermediate", "advanced"],
      review_status: [
        "pending",
        "approved",
        "needs_review",
        "rejected",
        "withdrawn",
      ],
      source_kind: [
        "textbook_private",
        "notes",
        "past_paper",
        "lab_manual",
        "handout",
        "solution",
        "scheme",
      ],
      source_visibility: ["private", "course", "bank"],
      submission_status: [
        "transcribing",
        "needs_confirmation",
        "marking",
        "done",
        "failed",
      ],
      task_kind: [
        "lesson",
        "review",
        "practice",
        "lab",
        "preview",
        "recap",
        "remediation",
        "mock",
        "teach_back",
      ],
      task_status: ["planned", "done", "skipped", "rolled"],
      user_role: ["student", "lecturer", "admin"],
    },
  },
} as const
