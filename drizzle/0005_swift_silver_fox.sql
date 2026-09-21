ALTER TABLE "app"."orders" DROP CONSTRAINT "orders_online_email_required";--> statement-breakpoint
ALTER TABLE "app"."orders" ADD CONSTRAINT "orders_contact_snapshot_state" CHECK ((
        (
          "app"."orders"."contact_erased_at" is not null
          and "app"."orders"."contact_name" is null
          and "app"."orders"."contact_phone_display" is null
          and "app"."orders"."contact_phone_search" is null
          and "app"."orders"."contact_email_display" is null
          and "app"."orders"."contact_email_search" is null
        )
        or (
          "app"."orders"."contact_erased_at" is null
          and "app"."orders"."contact_name" is not null
          and "app"."orders"."contact_phone_display" is not null
          and "app"."orders"."contact_phone_search" is not null
          and ("app"."orders"."contact_email_display" is null) = ("app"."orders"."contact_email_search" is null)
          and (
            "app"."orders"."source" <> 'online'
            or (
              "app"."orders"."contact_email_display" is not null
              and "app"."orders"."contact_email_search" is not null
            )
          )
        )
      ));