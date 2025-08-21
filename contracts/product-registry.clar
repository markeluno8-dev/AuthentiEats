;; AuthentiEats Product Registry Contract
;; Clarity v2
;; Manages registration and updates of food/beverage products with immutable metadata for traceability.
;; Supports authorized registrars, product owners, update history logging, and admin controls.
;; Ensures data integrity for supply chain transparency.

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-PAUSED u101)
(define-constant ERR-INVALID-ID u102)
(define-constant ERR-ALREADY-EXISTS u103)
(define-constant ERR-INVALID-STRING-LENGTH u104)
(define-constant ERR-INVALID-QUALITY u105)
(define-constant ERR-MAX-CERTS-EXCEEDED u106)
(define-constant ERR-ZERO-ADDRESS u107)
(define-constant ERR-NO-CHANGES u108)
(define-constant ERR-HISTORY-FULL u109)
(define-constant ERR-INVALID-OPTIONAL u110)

;; Contract metadata
(define-constant CONTRACT-NAME "AuthentiEats Product Registry")
(define-constant MAX_BATCH_ID_LENGTH u50)
(define-constant MAX_ORIGIN_LENGTH u100)
(define-constant MAX_CERT_LENGTH u50)
(define-constant MAX_CERTS u10)
(define-constant MAX_HISTORY_ENTRIES u50)
(define-constant MIN_QUALITY u0)
(define-constant MAX_QUALITY u100)

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var next-product-id uint u1)

;; Authorized registrars (besides admin)
(define-map authorized-registrars principal bool)

;; Product data: batch-id, origin, quality score (0-100), certifications
(define-map products uint
  {
    batch-id: (string-ascii 50),
    origin: (string-ascii 100),
    quality: uint,
    certifications: (list 10 (string-ascii 50)),
    registered-at: uint,
    last-updated: uint
  }
)

;; Product owners (initially the registrar)
(define-map product-owners uint principal)

;; Update history per product
(define-map update-history uint (list 50 {timestamp: uint, updater: principal, field: (string-ascii 20), old-value: (string-utf8 100), new-value: (string-utf8 100)}))

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: is-authorized-registrar
(define-private (is-authorized-registrar (caller principal))
  (or (is-admin) (default-to false (map-get? authorized-registrars caller)))
)

;; Private helper: validate string length
(define-private (validate-string-length (s (string-ascii 256)) (max-len uint))
  (begin
    (asserts! (<= (len s) max-len) (err ERR-INVALID-STRING-LENGTH))
    (ok true)
  )
)

;; Private helper: validate quality
(define-private (validate-quality (q uint))
  (begin
    (asserts! (and (>= q MIN_QUALITY) (<= q MAX_QUALITY)) (err ERR-INVALID-QUALITY))
    (ok true)
  )
)

;; Private helper: validate certifications
(define-private (validate-certs (certs (list 10 (string-ascii 50))))
  (begin
    (asserts! (<= (len certs) MAX_CERTS) (err ERR-MAX-CERTS-EXCEEDED))
    (fold validate-cert certs (ok true))
  )
)

;; Private helper: validate single cert
(define-private (validate-cert (cert (string-ascii 50)) (acc (response bool uint)))
  (match acc
    ok-val (validate-string-length cert MAX_CERT_LENGTH)
    err-val acc
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (print { event: "admin-transfer", old: tx-sender, new: new-admin })
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (print { event: "pause-set", paused: pause })
    (ok pause)
  )
)

;; Add authorized registrar
(define-public (add-registrar (registrar principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq registrar 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (map-set authorized-registrars registrar true)
    (print { event: "registrar-added", registrar: registrar })
    (ok true)
  )
)

;; Remove authorized registrar
(define-public (remove-registrar (registrar principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (map-delete authorized-registrars registrar)
    (print { event: "registrar-removed", registrar: registrar })
    (ok true)
  )
)

;; Register a new product
(define-public (register-product (batch-id (string-ascii 50)) (origin (string-ascii 100)) (quality uint) (certifications (list 10 (string-ascii 50))))
  (begin
    (ensure-not-paused)
    (asserts! (is-authorized-registrar tx-sender) (err ERR-NOT-AUTHORIZED))
    (try! (validate-string-length batch-id MAX_BATCH_ID_LENGTH))
    (try! (validate-string-length origin MAX_ORIGIN_LENGTH))
    (try! (validate-quality quality))
    (try! (validate-certs certifications))
    (let ((new-id (var-get next-product-id)))
      (var-set next-product-id (+ new-id u1))
      (map-set products new-id
        {
          batch-id: batch-id,
          origin: origin,
          quality: quality,
          certifications: certifications,
          registered-at: block-height,
          last-updated: block-height
        }
      )
      (map-set product-owners new-id tx-sender)
      (map-set update-history new-id (list ))
      (print { event: "product-registered", id: new-id, batch-id: batch-id, origin: origin, quality: quality, registrar: tx-sender })
      (ok new-id)
    )
  )
)

;; Update product metadata (only by owner or admin)
(define-public (update-product (id uint) (new-batch-id (optional (string-ascii 50))) (new-origin (optional (string-ascii 100))) (new-quality (optional uint)) (new-certs (optional (list 10 (string-ascii 50)))))
  (begin
    (ensure-not-paused)
    (let ((owner (default-to 'SP000000000000000000002Q6VF78 (map-get? product-owners id)))
          (current (map-get? products id)))
      (asserts! (is-some current) (err ERR-INVALID-ID))
      (asserts! (or (is-eq tx-sender owner) (is-admin)) (err ERR-NOT-AUTHORIZED))
      (let ((curr-data (unwrap! current (err ERR-INVALID-ID)))
            (history (default-to (list ) (map-get? update-history id)))
            (changes-made false))
        ;; Validate and apply updates if provided, building new history
        (let ((new-history
                (if (is-some new-batch-id)
                  (let ((val (unwrap! new-batch-id (err ERR-INVALID-OPTIONAL))))
                    (try! (validate-string-length val MAX_BATCH_ID_LENGTH))
                    (map-set products id (merge curr-data { batch-id: val, last-updated: block-height }))
                    (set changes-made true)
                    (append history { timestamp: block-height, updater: tx-sender, field: "batch-id", old-value: (unwrap-panic (as-max-len? (get batch-id curr-data) u100)), new-value: (unwrap-panic (as-max-len? val u100)) })
                  )
                  history
                )))
          (let ((new-history
                  (if (is-some new-origin)
                    (let ((val (unwrap! new-origin (err ERR-INVALID-OPTIONAL))))
                      (try! (validate-string-length val MAX_ORIGIN_LENGTH))
                      (map-set products id (merge curr-data { origin: val, last-updated: block-height }))
                      (set changes-made true)
                      (append new-history { timestamp: block-height, updater: tx-sender, field: "origin", old-value: (unwrap-panic (as-max-len? (get origin curr-data) u100)), new-value: (unwrap-panic (as-max-len? val u100)) })
                    )
                    new-history
                  )))
            (let ((new-history
                    (if (is-some new-quality)
                      (let ((val (unwrap! new-quality (err ERR-INVALID-OPTIONAL))))
                        (try! (validate-quality val))
                        (map-set products id (merge curr-data { quality: val, last-updated: block-height }))
                        (set changes-made true)
                        (append new-history { timestamp: block-height, updater: tx-sender, field: "quality", old-value: (int-to-utf8 (to-int (get quality curr-data))), new-value: (int-to-utf8 (to-int val)) })
                      )
                      new-history
                    )))
              (let ((new-history
                      (if (is-some new-certs)
                        (let ((val (unwrap! new-certs (err ERR-INVALID-OPTIONAL))))
                          (try! (validate-certs val))
                          (map-set products id (merge curr-data { certifications: val, last-updated: block-height }))
                          (set changes-made true)
                          (append new-history { timestamp: block-height, updater: tx-sender, field: "certifications", old-value: (fold concat-certs (get certifications curr-data) u""), new-value: (fold concat-certs val u"") })
                        )
                        new-history
                      )))
                (asserts! changes-made (err ERR-NO-CHANGES))
                (asserts! (<= (len new-history) MAX_HISTORY_ENTRIES) (err ERR-HISTORY-FULL))
                (map-set update-history id new-history)
                (print { event: "product-updated", id: id, updater: tx-sender })
                (ok true)
              )
            )
          )
        )
      )
    )
  )
)

;; Helper for concat certs (for history, simplified)
(define-private (concat-certs (cert (string-ascii 50)) (acc (string-utf8 500)))
  (unwrap-panic (as-max-len? (concat acc (concat u"," cert)) u500))
)

;; Transfer product ownership
(define-public (transfer-ownership (id uint) (new-owner principal))
  (begin
    (ensure-not-paused)
    (let ((current-owner (map-get? product-owners id)))
      (asserts! (is-some current-owner) (err ERR-INVALID-ID))
      (asserts! (is-eq tx-sender (unwrap! current-owner (err ERR-INVALID-ID))) (err ERR-NOT-AUTHORIZED))
      (asserts! (not (is-eq new-owner 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
      (map-set product-owners id new-owner)
      (print { event: "ownership-transferred", id: id, old: tx-sender, new: new-owner })
      (ok true)
    )
  )
)

;; Read-only: get product details
(define-read-only (get-product (id uint))
  (match (map-get? products id)
    data (ok data)
    (err ERR-INVALID-ID)
  )
)

;; Read-only: get product owner
(define-read-only (get-product-owner (id uint))
  (match (map-get? product-owners id)
    owner (ok owner)
    (err ERR-INVALID-ID)
  )
)

;; Read-only: get update history
(define-read-only (get-update-history (id uint))
  (match (map-get? update-history id)
    hist (ok hist)
    (err ERR-INVALID-ID)
  )
)

;; Read-only: get next id
(define-read-only (get-next-id)
  (ok (var-get next-product-id))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: is paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: is registrar
(define-read-only (check-is-registrar (account principal))
  (ok (default-to false (map-get? authorized-registrars account)))
)