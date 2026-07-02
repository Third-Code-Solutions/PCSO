/**
 * LDM-010 — Certificate of Training PDF template.
 *
 * Landscape A4. PCSO organisational header, participant name as the focal
 * point, program metadata, signatory slots, serial bottom-left, and a
 * scannable QR bottom-right that encodes the `/verify/[token]` URL carrying
 * the signed HS256 JWT (PIM-017 / §6.1 QR-verified document authenticity).
 *
 * The QR is generated with the dependency-free encoder in
 * `src/lib/utils/qr/qr-encoder.ts` and rendered as a single SVG path.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Rect,
  Path,
} from "@react-pdf/renderer";
import {
  encodeQrMatrix,
  qrMatrixToSvgPath,
} from "@/lib/utils/qr/qr-encoder";

const NAVY = "#0B2545";
const GOLD = "#C8A84B";
const BORDER = "#6B7280";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    padding: 48,
    fontSize: 11,
    color: "#111827",
  },
  outerBorder: {
    borderWidth: 4,
    borderColor: NAVY,
    padding: 12,
    flexGrow: 1,
  },
  innerBorder: {
    borderWidth: 1,
    borderColor: GOLD,
    padding: 28,
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  orgName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  orgSub: {
    fontSize: 9,
    color: BORDER,
    marginTop: 2,
  },
  eyebrow: {
    fontSize: 10,
    color: GOLD,
    letterSpacing: 4,
    marginTop: 22,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
    marginTop: 6,
  },
  lead: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 20,
    color: "#374151",
  },
  participantName: {
    fontSize: 34,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: GOLD,
    paddingBottom: 10,
  },
  body: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 14,
    color: "#1F2937",
    lineHeight: 1.4,
  },
  programTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center",
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    gap: 24,
  },
  metaCell: {
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 8,
    color: BORDER,
    letterSpacing: 2,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 36,
  },
  signCell: {
    alignItems: "center",
    width: "40%",
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: NAVY,
    width: "100%",
    marginTop: 32,
  },
  signName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
  signRole: {
    fontSize: 8,
    color: BORDER,
    marginTop: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 28,
  },
  serialBlock: {
    maxWidth: 260,
  },
  serialLabel: {
    fontSize: 8,
    color: BORDER,
    letterSpacing: 2,
  },
  serialValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 2,
  },
  verifyUrl: {
    fontSize: 7,
    color: BORDER,
    marginTop: 2,
  },
  qrBlock: {
    alignItems: "center",
  },
  qrLabel: {
    fontSize: 7,
    color: BORDER,
    marginTop: 4,
    textAlign: "center",
    width: 96,
  },
});

export interface CertificateOfTrainingProps {
  serial: string;
  participantName: string;
  programTitle: string;
  provider: string | null;
  startDate: string | null;
  endDate: string | null;
  verifyUrl: string;
  issuedAt: Date;
  organizationName?: string;
  organizationSub?: string;
  trainingDirectorName?: string;
  hrdManagerName?: string;
}

function formatDate(input: string | null | Date): string {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const QR_QUIET_ZONE_MODULES = 2;

function VerificationQr({ verifyUrl }: { verifyUrl: string }) {
  // EC level M balances density and print-damage tolerance for the JWT URL.
  const qr = encodeQrMatrix(verifyUrl, "M");
  const viewSize = qr.size + QR_QUIET_ZONE_MODULES * 2;
  const path = qrMatrixToSvgPath(qr, QR_QUIET_ZONE_MODULES);
  return (
    <View style={styles.qrBlock}>
      <Svg width={96} height={96} viewBox={`0 0 ${viewSize} ${viewSize}`}>
        <Rect
          x={0}
          y={0}
          width={viewSize}
          height={viewSize}
          fill="#FFFFFF"
        />
        <Path d={path} fill="#000000" />
      </Svg>
      <Text style={styles.qrLabel}>Scan to verify authenticity</Text>
    </View>
  );
}

export function CertificateOfTraining(
  props: CertificateOfTrainingProps,
): React.ReactElement {
  const {
    serial,
    participantName,
    programTitle,
    provider,
    startDate,
    endDate,
    verifyUrl,
    issuedAt,
    organizationName = "Philippine Charity Sweepstakes Office",
    organizationSub = "Human Resource Development Division",
    trainingDirectorName = "_______________________",
    hrdManagerName = "_______________________",
  } = props;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder}>
            <View style={styles.header}>
              <Text style={styles.orgName}>{organizationName}</Text>
              <Text style={styles.orgSub}>{organizationSub}</Text>
            </View>

            <Text style={styles.eyebrow}>CERTIFICATE OF TRAINING</Text>
            <Text style={styles.title}>Completion</Text>

            <Text style={styles.lead}>This certifies that</Text>
            <Text style={styles.participantName}>{participantName}</Text>
            <Text style={styles.body}>
              has successfully completed the training program
            </Text>
            <Text style={styles.programTitle}>{programTitle}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>PROVIDER</Text>
                <Text style={styles.metaValue}>{provider ?? "—"}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>DATES</Text>
                <Text style={styles.metaValue}>
                  {formatDate(startDate)} – {formatDate(endDate)}
                </Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>ISSUED</Text>
                <Text style={styles.metaValue}>{formatDate(issuedAt)}</Text>
              </View>
            </View>

            <View style={styles.signRow}>
              <View style={styles.signCell}>
                <View style={styles.signLine} />
                <Text style={styles.signName}>{trainingDirectorName}</Text>
                <Text style={styles.signRole}>Training Director</Text>
              </View>
              <View style={styles.signCell}>
                <View style={styles.signLine} />
                <Text style={styles.signName}>{hrdManagerName}</Text>
                <Text style={styles.signRole}>HRD Manager</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.serialBlock}>
                <Text style={styles.serialLabel}>SERIAL NUMBER</Text>
                <Text style={styles.serialValue}>{serial}</Text>
                <Text style={styles.verifyUrl}>{verifyUrl}</Text>
              </View>
              <VerificationQr verifyUrl={verifyUrl} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default CertificateOfTraining;
