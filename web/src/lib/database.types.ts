
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activities": {
                  Row: {
                    "id": string,"name": string,"slug": string,"sort_order": number,"status": Database["public"]['Enums']["activity_status"]
                  }
                  Insert: {
                    "id"?: string,"name": string,"slug": string,"sort_order"?: number,"status"?: Database["public"]['Enums']["activity_status"]
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number,"status"?: Database["public"]['Enums']["activity_status"]
                  }
                  Relationships: [
                    
                  ]
                },"admin_access_log": {
                  Row: {
                    "action": string,"admin_id": string,"created_at": string,"id": string,"target_id": string | null,"target_type": string
                  }
                  Insert: {
                    "action": string,"admin_id": string,"created_at"?: string,"id"?: string,"target_id"?: string | null,"target_type": string
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string,"created_at"?: string,"id"?: string,"target_id"?: string | null,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_config": {
                  Row: {
                    "key": string,"value": NonNullable<Json>
                  }
                  Insert: {
                    "key": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"bans": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["ban_kind"],"report_id": string | null,"value_normalized": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["ban_kind"],"report_id"?: string | null,"value_normalized": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["ban_kind"],"report_id"?: string | null,"value_normalized"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bans_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cities": {
                  Row: {
                    "lat": number,"lng": number,"name": string,"popular": number | null,"slug": string
                  }
                  Insert: {
                    "lat": number,"lng": number,"name": string,"popular"?: number | null,"slug": string
                  }
                  Update: {
                    "lat"?: number,"lng"?: number,"name"?: string,"popular"?: number | null,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"conversation_members": {
                  Row: {
                    "conversation_id": string,"joined_at": string,"last_read_at": string | null,"left_at": string | null,"user_id": string
                  }
                  Insert: {
                    "conversation_id": string,"joined_at"?: string,"last_read_at"?: string | null,"left_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"joined_at"?: string,"last_read_at"?: string | null,"left_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_members_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"group_id": string | null,"id": string,"is_frozen": boolean,"kind": Database["public"]['Enums']["conversation_kind"],"last_message_at": string | null,"match_id": string | null,"message_cap": number,"message_count": number,"retained": boolean
                  }
                  Insert: {
                    "created_at"?: string,"group_id"?: string | null,"id"?: string,"is_frozen"?: boolean,"kind": Database["public"]['Enums']["conversation_kind"],"last_message_at"?: string | null,"match_id"?: string | null,"message_cap": number,"message_count"?: number,"retained"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string | null,"id"?: string,"is_frozen"?: boolean,"kind"?: Database["public"]['Enums']["conversation_kind"],"last_message_at"?: string | null,"match_id"?: string | null,"message_cap"?: number,"message_count"?: number,"retained"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_group_id_fkey"
      columns: ["group_id"]
isOneToOne: true
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"email_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"id": string,"last_error": string | null,"payload": NonNullable<Json>,"sent_at": string | null,"status": Database["public"]['Enums']["email_status"],"template": string,"to_email": string,"user_id": string | null
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["email_status"],"template": string,"to_email": string,"user_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"id"?: string,"last_error"?: string | null,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["email_status"],"template"?: string,"to_email"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_outbox_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"events_log": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"props": NonNullable<Json>,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"props"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"props"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"group_invite_links": {
                  Row: {
                    "created_at": string,"group_id": string,"token": string
                  }
                  Insert: {
                    "created_at"?: string,"group_id": string,"token": string
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_invite_links_group_id_fkey"
      columns: ["group_id"]
isOneToOne: true
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "approved_at": string | null,"created_at": string,"group_id": string,"role": Database["public"]['Enums']["group_role"],"status": Database["public"]['Enums']["group_member_status"],"user_id": string,"via_link": boolean
                  }
                  Insert: {
                    "approved_at"?: string | null,"created_at"?: string,"group_id": string,"role"?: Database["public"]['Enums']["group_role"],"status": Database["public"]['Enums']["group_member_status"],"user_id": string,"via_link"?: boolean
                  }
                  Update: {
                    "approved_at"?: string | null,"created_at"?: string,"group_id"?: string,"role"?: Database["public"]['Enums']["group_role"],"status"?: Database["public"]['Enums']["group_member_status"],"user_id"?: string,"via_link"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "activity_id": string,"admin_id": string | null,"city": string | null,"created_at": string,"description": string | null,"event_date": string | null,"id": string,"lat": number | null,"lng": number | null,"max_members": number,"status": Database["public"]['Enums']["group_status"],"title": string,"venue": string | null
                  }
                  Insert: {
                    "activity_id": string,"admin_id"?: string | null,"city"?: string | null,"created_at"?: string,"description"?: string | null,"event_date"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"max_members": number,"status"?: Database["public"]['Enums']["group_status"],"title": string,"venue"?: string | null
                  }
                  Update: {
                    "activity_id"?: string,"admin_id"?: string | null,"city"?: string | null,"created_at"?: string,"description"?: string | null,"event_date"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"max_members"?: number,"status"?: Database["public"]['Enums']["group_status"],"title"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "groups_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "activity_id": string,"created_at": string,"id": string,"swipe_id": string | null,"user_a": string,"user_b": string
                  }
                  Insert: {
                    "activity_id": string,"created_at"?: string,"id"?: string,"swipe_id"?: string | null,"user_a": string,"user_b": string
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string,"id"?: string,"swipe_id"?: string | null,"user_a"?: string,"user_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_swipe_id_fkey"
      columns: ["swipe_id"]
isOneToOne: false
      referencedRelation: "swipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_user_a_fkey"
      columns: ["user_a"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_user_b_fkey"
      columns: ["user_b"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"sender_id": string | null
                  }
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"sender_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"payload": NonNullable<Json>,"read_at": string | null,"type": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "checked_at": string | null,"created_at": string,"id": string,"position": number,"storage_path": string,"user_id": string
                  }
                  Insert: {
                    "checked_at"?: string | null,"created_at"?: string,"id"?: string,"position": number,"storage_path": string,"user_id": string
                  }
                  Update: {
                    "checked_at"?: string | null,"created_at"?: string,"id"?: string,"position"?: number,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_answers": {
                  Row: {
                    "answer": string,"created_at": string,"position": number,"prompt_key": string,"user_id": string
                  }
                  Insert: {
                    "answer": string,"created_at"?: string,"position": number,"prompt_key": string,"user_id": string
                  }
                  Update: {
                    "answer"?: string,"created_at"?: string,"position"?: number,"prompt_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_answers_prompt_key_fkey"
      columns: ["prompt_key"]
isOneToOne: false
      referencedRelation: "prompts"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "profile_answers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "email": string | null,"full_name": string | null,"phone": string | null,"socials": NonNullable<Json>,"user_id": string
                  }
                  Insert: {
                    "email"?: string | null,"full_name"?: string | null,"phone"?: string | null,"socials"?: NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "email"?: string | null,"full_name"?: string | null,"phone"?: string | null,"socials"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_views": {
                  Row: {
                    "viewed_id": string,"viewed_on": string,"viewer_id": string
                  }
                  Insert: {
                    "viewed_id": string,"viewed_on"?: string,"viewer_id": string
                  }
                  Update: {
                    "viewed_id"?: string,"viewed_on"?: string,"viewer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_views_viewed_id_fkey"
      columns: ["viewed_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_views_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "bio": string | null,"city": string | null,"consent_at": string | null,"created_at": string,"dob": string | null,"first_name": string | null,"gender": Database["public"]['Enums']["gender"] | null,"gender_preference": (Database["public"]['Enums']["gender"])[] | null,"id": string,"is_banned": boolean,"lat": number | null,"lng": number | null,"location_source": string | null,"location_updated_at": string | null,"onboarding_complete": boolean,"plan": string | null,"public_code": string,"seeking": Database["public"]['Enums']["seeking"] | null,"verification_status": Database["public"]['Enums']["verification_status"],"verified_at": string | null,"verified_by": string | null
                  }
                  Insert: {
                    "bio"?: string | null,"city"?: string | null,"consent_at"?: string | null,"created_at"?: string,"dob"?: string | null,"first_name"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"gender_preference"?: (Database["public"]['Enums']["gender"])[] | null,"id": string,"is_banned"?: boolean,"lat"?: number | null,"lng"?: number | null,"location_source"?: string | null,"location_updated_at"?: string | null,"onboarding_complete"?: boolean,"plan"?: string | null,"public_code": string,"seeking"?: Database["public"]['Enums']["seeking"] | null,"verification_status"?: Database["public"]['Enums']["verification_status"],"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Update: {
                    "bio"?: string | null,"city"?: string | null,"consent_at"?: string | null,"created_at"?: string,"dob"?: string | null,"first_name"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"gender_preference"?: (Database["public"]['Enums']["gender"])[] | null,"id"?: string,"is_banned"?: boolean,"lat"?: number | null,"lng"?: number | null,"location_source"?: string | null,"location_updated_at"?: string | null,"onboarding_complete"?: boolean,"plan"?: string | null,"public_code"?: string,"seeking"?: Database["public"]['Enums']["seeking"] | null,"verification_status"?: Database["public"]['Enums']["verification_status"],"verified_at"?: string | null,"verified_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"prompts": {
                  Row: {
                    "active": boolean,"key": string,"question": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"key": string,"question": string,"sort_order": number
                  }
                  Update: {
                    "active"?: boolean,"key"?: string,"question"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "chat_share_consent": boolean,"conversation_id": string | null,"created_at": string,"details": string | null,"id": string,"reason": Database["public"]['Enums']["report_reason"],"reported_id": string,"reported_identifiers": NonNullable<Json>,"reporter_id": string,"resolution": Database["public"]['Enums']["report_resolution"] | null,"resolved_at": string | null,"resolved_by": string | null,"snapshot": Json | null,"status": Database["public"]['Enums']["report_status"]
                  }
                  Insert: {
                    "chat_share_consent": boolean,"conversation_id"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"reason": Database["public"]['Enums']["report_reason"],"reported_id": string,"reported_identifiers"?: NonNullable<Json>,"reporter_id": string,"resolution"?: Database["public"]['Enums']["report_resolution"] | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"snapshot"?: Json | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Update: {
                    "chat_share_consent"?: boolean,"conversation_id"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: Database["public"]['Enums']["report_reason"],"reported_id"?: string,"reported_identifiers"?: NonNullable<Json>,"reporter_id"?: string,"resolution"?: Database["public"]['Enums']["report_resolution"] | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"snapshot"?: Json | null,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"swipes": {
                  Row: {
                    "action": Database["public"]['Enums']["swipe_action"],"activity_id": string,"created_at": string,"from_user": string,"id": string,"responded_at": string | null,"status": Database["public"]['Enums']["swipe_status"] | null,"to_user": string
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["swipe_action"],"activity_id": string,"created_at"?: string,"from_user": string,"id"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["swipe_status"] | null,"to_user": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["swipe_action"],"activity_id"?: string,"created_at"?: string,"from_user"?: string,"id"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["swipe_status"] | null,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "swipes_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_from_user_fkey"
      columns: ["from_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_to_user_fkey"
      columns: ["to_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_activities": {
                  Row: {
                    "activity_id": string,"user_id": string
                  }
                  Insert: {
                    "activity_id": string,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_activities_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_activities_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_videos": {
                  Row: {
                    "created_at": string,"delete_after": string | null,"deleted_at": string | null,"id": string,"reject_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["video_status"],"storage_path": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"delete_after"?: string | null,"deleted_at"?: string | null,"id"?: string,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["video_status"],"storage_path": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"delete_after"?: string | null,"deleted_at"?: string | null,"id"?: string,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["video_status"],"storage_path"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_videos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"waitlist": {
                  Row: {
                    "created_at": string,"email": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_bans":
{ Args: Record<PropertyKey, never>; Returns: {
              "banned_code": string,"banned_name": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["ban_kind"],"report_id": string,"report_reason": Database["public"]['Enums']["report_reason"],"value": string
            }[]
                           },
"admin_get_report":
{ Args: { "p_report_id": string }; Returns: Json
                           },
"admin_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_new_photos":
{ Args: Record<PropertyKey, never>; Returns: {
              "added_at": string,"first_name": string,"photo_id": string,"public_code": string,"storage_path": string,"user_id": string,"verified_at": string,"verified_paths": (string)[]
            }[]
                           },
"admin_reports_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"message_count": number,"reason": Database["public"]['Enums']["report_reason"],"report_id": string,"reported_banned": boolean,"reported_code": string,"reported_id": string,"reported_name": string,"reporter_code": string,"reporter_name": string,"reports_against": number,"status": Database["public"]['Enums']["report_status"]
            }[]
                           },
"admin_resolve_report":
{ Args: { "p_report_id": string,"p_resolution": Database["public"]['Enums']["report_resolution"] }; Returns: undefined
                           },
"admin_review_photo":
{ Args: { "p_keep": boolean,"p_photo_id": string }; Returns: string
                           },
"admin_review_verification":
{ Args: { "p_approve": boolean,"p_reason"?: string,"p_user_id": string }; Returns: undefined
                           },
"admin_verification_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "age": number,"first_name": string,"gender": Database["public"]['Enums']["gender"],"is_resubmission": boolean,"photo_paths": (string)[],"public_code": string,"submitted_at": string,"user_id": string,"video_id": string
            }[]
                           },
"block_user":
{ Args: { "p_target_id": string }; Returns: undefined
                           },
"cancel_join_request":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"complete_onboarding":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"create_group":
{ Args: { "p_activity_id": string,"p_description": string,"p_event_date": string,"p_max_members": number,"p_title": string,"p_venue": string }; Returns: Json
                           },
"get_badge_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "likes": number,"matches": number
            }[]
                           },
"get_blocked_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "blocked_at": string,"first_name": string,"public_code": string,"user_id": string
            }[]
                           },
"get_contact":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"get_conversation":
{ Args: { "p_conversation_id": string }; Returns: Json
                           },
"get_feed":
{ Args: { "p_activity_id": string,"p_limit"?: number }; Returns: Json
                           },
"get_group":
{ Args: { "p_group_id": string }; Returns: Json
                           },
"get_group_interested":
{ Args: { "p_group_id": string }; Returns: {
              "age": number,"bio": string,"first_name": string,"photo_paths": (string)[],"public_code": string,"seeking": Database["public"]['Enums']["seeking"],"since": string,"status": Database["public"]['Enums']["group_member_status"],"user_id": string,"via_link": boolean
            }[]
                           },
"get_group_invite":
{ Args: { "p_token": string }; Returns: Json
                           },
"get_group_invite_link":
{ Args: { "p_group_id": string }; Returns: string
                           },
"get_group_invites":
{ Args: Record<PropertyKey, never>; Returns: {
              "admin_name": string,"description": string,"event_date": string,"group_id": string,"invited_at": string,"max_members": number,"member_count": number,"title": string,"venue": string
            }[]
                           },
"get_group_member_profile":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: Json
                           },
"get_groups":
{ Args: { "p_activity_id": string }; Returns: {
              "admin_name": string,"created_at": string,"description": string,"event_date": string,"id": string,"max_members": number,"member_count": number,"my_status": Database["public"]['Enums']["group_member_status"],"status": Database["public"]['Enums']["group_status"],"title": string,"venue": string
            }[]
                           },
"get_incoming_likes":
{ Args: Record<PropertyKey, never>; Returns: {
              "activity_id": string,"age": number,"bio": string,"first_name": string,"gender": Database["public"]['Enums']["gender"],"liked_at": string,"photo_paths": (string)[],"public_code": string,"swipe_id": string,"user_id": string
            }[]
                           },
"get_matches":
{ Args: Record<PropertyKey, never>; Returns: {
              "activity_id": string,"age": number,"conversation_id": string,"first_name": string,"is_new": boolean,"last_message_at": string,"match_id": string,"matched_at": string,"photo_path": string,"public_code": string,"unread": boolean,"user_id": string
            }[]
                           },
"get_messages":
{ Args: { "p_before"?: string,"p_conversation_id": string,"p_limit"?: number }; Returns: {
              "body": string,"created_at": string,"id": string,"sender_id": string
            }[]
                           },
"get_my_groups":
{ Args: Record<PropertyKey, never>; Returns: {
              "conversation_id": string,"event_date": string,"group_id": string,"is_new": boolean,"last_message_at": string,"max_members": number,"member_count": number,"pending_requests": number,"role": Database["public"]['Enums']["group_role"],"title": string,"unread": boolean
            }[]
                           },
"get_profile_answers":
{ Args: { "p_user_id": string }; Returns: {
              "answer": string,"prompt_key": string,"question": string
            }[]
                           },
"invite_to_group":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: undefined
                           },
"join_waitlist":
{ Args: { "p_email": string }; Returns: undefined
                           },
"leave_group":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"like_profile":
{ Args: { "p_activity_id": string,"p_target_id": string }; Returns: Json
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"orphaned_storage_objects":
{ Args: { "p_bucket": string,"p_limit"?: number }; Returns: {
              "name": string
            }[]
                           },
"pass_profile":
{ Args: { "p_activity_id": string,"p_target_id": string }; Returns: undefined
                           },
"ping":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"remove_member":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: undefined
                           },
"reorder_photos":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"report_user":
{ Args: { "p_consent": boolean,"p_conversation_id": string,"p_details": string,"p_reason": Database["public"]['Enums']["report_reason"],"p_reported_id": string }; Returns: string
                           },
"request_join":
{ Args: { "p_group_id": string }; Returns: Database["public"]['Enums']["group_member_status"]
                           },
"request_join_by_link":
{ Args: { "p_token": string }; Returns: Json
                           },
"reset_group_invite_link":
{ Args: { "p_group_id": string }; Returns: string
                           },
"respond_invite":
{ Args: { "p_accept": boolean,"p_group_id": string }; Returns: undefined
                           },
"respond_join_request":
{ Args: { "p_approve": boolean,"p_group_id": string,"p_user_id": string }; Returns: undefined
                           },
"respond_to_like":
{ Args: { "p_accept": boolean,"p_swipe_id": string }; Returns: Json
                           },
"save_about":
{ Args: { "p_answers": Json,"p_bio": string }; Returns: undefined
                           },
"save_basics":
{ Args: { "p_consent": boolean,"p_dob": string,"p_full_name": string,"p_gender": Database["public"]['Enums']["gender"],"p_gender_preference": (Database["public"]['Enums']["gender"])[],"p_seeking": Database["public"]['Enums']["seeking"] }; Returns: undefined
                           },
"save_contact":
{ Args: { "p_phone": string,"p_socials": Json }; Returns: undefined
                           },
"send_message":
{ Args: { "p_body": string,"p_conversation_id": string }; Returns: Json
                           },
"set_my_city":
{ Args: { "p_city": string }; Returns: Json
                           },
"set_my_position":
{ Args: { "p_lat": number,"p_lng": number }; Returns: Json
                           },
"submit_verification":
{ Args: { "p_storage_path": string }; Returns: undefined
                           },
"unblock_user":
{ Args: { "p_target_id": string }; Returns: undefined
                           },
"update_preferences":
{ Args: { "p_gender_preference": (Database["public"]['Enums']["gender"])[],"p_seeking": Database["public"]['Enums']["seeking"] }; Returns: undefined
                           },
"vote_coming_soon":
{ Args: { "p_slug": string }; Returns: undefined
                           }
          }
          Enums: {
            "activity_status": "live"|"coming_soon","ban_kind": "email"|"phone"|"instagram"|"snapchat"|"whatsapp"|"telegram","conversation_kind": "direct"|"group","email_status": "pending"|"sent"|"failed","gender": "man"|"woman"|"non_binary","group_member_status": "requested"|"invited"|"approved"|"rejected"|"left"|"removed","group_role": "admin"|"member","group_status": "open"|"full"|"closed","report_reason": "harassment"|"fake_profile"|"inappropriate"|"safety_threat"|"spam"|"other","report_resolution": "no_action"|"warning"|"ban","report_status": "open"|"reviewing"|"resolved","seeking": "group"|"friend","swipe_action": "like"|"pass","swipe_status": "held"|"pending"|"accepted"|"rejected"|"discarded","verification_status": "unsubmitted"|"pending"|"approved"|"rejected","video_status": "pending"|"approved"|"rejected"
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
  "public": {
          Enums: {
            "activity_status": ["live", "coming_soon"],"ban_kind": ["email", "phone", "instagram", "snapchat", "whatsapp", "telegram"],"conversation_kind": ["direct", "group"],"email_status": ["pending", "sent", "failed"],"gender": ["man", "woman", "non_binary"],"group_member_status": ["requested", "invited", "approved", "rejected", "left", "removed"],"group_role": ["admin", "member"],"group_status": ["open", "full", "closed"],"report_reason": ["harassment", "fake_profile", "inappropriate", "safety_threat", "spam", "other"],"report_resolution": ["no_action", "warning", "ban"],"report_status": ["open", "reviewing", "resolved"],"seeking": ["group", "friend"],"swipe_action": ["like", "pass"],"swipe_status": ["held", "pending", "accepted", "rejected", "discarded"],"verification_status": ["unsubmitted", "pending", "approved", "rejected"],"video_status": ["pending", "approved", "rejected"]
          }
        }
} as const

