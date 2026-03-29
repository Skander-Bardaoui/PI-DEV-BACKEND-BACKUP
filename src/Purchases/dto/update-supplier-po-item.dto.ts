import { PartialType } from "@nestjs/mapped-types";
import { CreateSupplierPOItemDto } from "./create-supplier-po-item.dto";

export class UpdateSupplierPOItemDto extends PartialType(CreateSupplierPOItemDto) {}